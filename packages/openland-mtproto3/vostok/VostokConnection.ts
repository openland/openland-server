import { createIterator } from '../../openland-utils/asyncIterator';
import { delay } from '../../openland-utils/timer';
import { PING_CLOSE_TIMEOUT, PING_TIMEOUT, TopLevelMessages } from './vostokServer';
import WebSocket = require('ws');
import { createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';
import { asyncRun } from '../utils';
import { vostok } from './schema/schema';
import { VostokSocket } from './VostokSocket';

const rootCtx = createNamedContext('vostok');
const log = createLogger('vostok');

export class VostokConnection {
    protected socket: VostokSocket|null = null;
    protected incomingData = createIterator<TopLevelMessages>(() => 0);

    public lastPingAck: number = Date.now();
    public pingCounter = 0;
    public pingAckCounter = 0;

    setSocket(socket: VostokSocket) {
        this.socket = socket;
        // socket.on('message', async data => this.onMessage(socket, data));
        // socket.on('close', () => this.onSocketClose());
        this.setupPingLoop();

        asyncRun(async () => {
            for await (let msg of socket.getIterator()) {
                this.onMessage(socket, msg);
            }
        });
    }

    getIncomingMessagesIterator() {
        this.incomingData = createIterator<TopLevelMessages>(() => 0);
        return this.incomingData;
    }

    // isConnected = () => this.socket!.readyState === this.socket!.OPEN;
    isConnected = () => true;

    sendPing = () => this.sendBuff(vostok.TopMessage.encode({ ping: { id: ++this.pingCounter }}).finish());

    // sendBuff = (data: Uint8Array) => this.socket!.send(data);

    sendBuff = (data: Uint8Array) => this.socket!.send(data);

    close() {
        this.socket!.close();
        this.onSocketClose();
    }

    private onMessage(socket: VostokSocket, data: WebSocket.Data) {
        // log.log(rootCtx, '<-', data);
        try {
            if (!(data instanceof Buffer)) {
                log.log(rootCtx, 'got invalid message from client', data);
                this.sendBuff(vostok.TopMessage.encode({ invalidMessage: { } }).finish());
                this.close();
                return;
            }

            let msgData = vostok.TopMessage.decode(data);
            log.log(rootCtx, '<-', msgData);

            if (msgData.pong) {
                this.lastPingAck = Date.now();
                this.pingAckCounter++;
            } else if (msgData.ping) {
                this.sendBuff(vostok.Pong.encode({ id: 1 }).finish());
            } else if (msgData.message) {
                this.incomingData.push(msgData.message);
            } else if (msgData.ackMessages) {
                this.incomingData.push(msgData.ackMessages);
            } else if (msgData.messagesInfoRequest) {
                this.incomingData.push(msgData.messagesInfoRequest);
            } else if (msgData.messagesContainer && msgData.messagesContainer.messages) {
                msgData.messagesContainer.messages.forEach(msg => {
                    if (msg.message) {
                        this.incomingData.push(msg.message);
                    } else if (msg.ackMessages) {
                        this.incomingData.push(msg.ackMessages);
                    } else if (msg.messagesInfoRequest) {
                        this.incomingData.push(msg.messagesInfoRequest);
                    } else if (msg.resendMessageAnswerRequest) {
                        this.incomingData.push(msg.resendMessageAnswerRequest);
                    } else if (msg.messageNotFoundResponse) {
                        this.incomingData.push(msg.messageNotFoundResponse);
                    }
                });
            } else if (msgData.resendMessageAnswerRequest) {
                this.incomingData.push(msgData.resendMessageAnswerRequest);
            } else if (msgData.messageNotFoundResponse) {
                this.incomingData.push(msgData.messageNotFoundResponse);
            } else {
                log.log(rootCtx, 'unexpected top level message:', msgData);
            }
        } catch (e) {
            log.log(rootCtx, 'got invalid message from client', data);
            this.sendBuff(vostok.TopMessage.encode({ invalidMessage: { } }).finish());
            this.close();
        }
    }

    private onSocketClose() {
        // this.incomingData.complete();
    }

    private setupPingLoop() {
        asyncRun(async () => {
            let timeout: NodeJS.Timeout|null = null;
            while (this.isConnected()) {
                // Send ping only if previous one was acknowledged
                if (this.pingCounter !== this.pingAckCounter) {
                    await delay(PING_TIMEOUT);
                    continue;
                }
                this.sendPing();
                if (timeout) {
                    clearTimeout(timeout);
                }
                timeout = setTimeout(() => {
                    if (this.isConnected() && Date.now() - this.lastPingAck > PING_CLOSE_TIMEOUT) {
                        this.socket!.close();
                    }
                }, PING_CLOSE_TIMEOUT);
                await delay(PING_TIMEOUT);
            }
        });
    }
}
