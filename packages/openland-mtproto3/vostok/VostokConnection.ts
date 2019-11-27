import { createIterator } from '../../openland-utils/asyncIterator';
import { delay } from '../../openland-utils/timer';
import {
    decodeAckMessages,
    decodeMessage, decodeMessageNotFoundResponse, decodeMessagesContainer,
    decodeMessagesInfoRequest,
    decodePing, decodeResendMessageAnswerRequest,
    encodeInvalidMessage,
    encodePing,
    encodePong,
    isAckMessages,
    isMessage, isMessageNotFoundResponse, isMessagesContainer,
    isMessagesInfoRequest,
    isPing,
    isPong, isResendMessageAnswerRequest,
    KnownTypes,
    makeInvalidMessage,
    makePing,
    makePong
} from '../vostok-schema/VostokTypes';
import { PING_CLOSE_TIMEOUT, PING_TIMEOUT } from './vostokServer';
import WebSocket = require('ws');
import { createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';
import { asyncRun } from '../utils';

const rootCtx = createNamedContext('vostok');
const log = createLogger('vostok');

export class VostokConnection {
    protected socket: WebSocket|null = null;
    protected incomingData = createIterator<KnownTypes>(() => 0);

    public lastPingAck: number = Date.now();
    public pingCounter = 0;
    public pingAckCounter = 0;

    setSocket(socket: WebSocket) {
        this.socket = socket;
        socket.on('message', async data => this.onMessage(socket, data));
        socket.on('close', () => this.onSocketClose());
        this.setupPingLoop();
    }

    getIncomingMessagesIterator() {
        this.incomingData = createIterator<KnownTypes>(() => 0);
        return this.incomingData;
    }

    isConnected() {
        return this.socket!.readyState === this.socket!.OPEN;
    }

    sendPing() {
        this.sendRaw(encodePing(makePing({ id: ++this.pingCounter })));
    }

    sendRaw(data: any) {
        this.socket!.send(JSON.stringify(data));
    }

    close() {
        this.socket!.close();
        this.onSocketClose();
    }

    private onMessage(socket: WebSocket, data: WebSocket.Data) {
        log.log(rootCtx, '<-', data);
        try {
            let msgData = JSON.parse(data.toString());
            if (isPong(msgData)) {
                this.lastPingAck = Date.now();
                this.pingAckCounter++;
            } else if (isPing(msgData)) {
                let ping = decodePing(msgData);
                this.sendRaw(encodePong(makePong({ id: ping.id })));
            } else if (isMessage(msgData)) {
                this.incomingData.push(decodeMessage(msgData));
            } else if (isAckMessages(msgData)) {
                this.incomingData.push(decodeAckMessages(msgData));
            } else if (isMessagesInfoRequest(msgData)) {
                this.incomingData.push(decodeMessagesInfoRequest(msgData));
            } else if (isMessagesContainer(msgData)) {
                decodeMessagesContainer(msgData).messages.forEach(msg => this.incomingData.push(msg));
            } else if (isResendMessageAnswerRequest(msgData)) {
                this.incomingData.push(decodeResendMessageAnswerRequest(msgData));
            } else if (isMessageNotFoundResponse(msgData)) {
                this.incomingData.push(decodeMessageNotFoundResponse(msgData));
            } else {
                log.log(rootCtx, 'unexpected top level message:', msgData);
            }
        } catch (e) {
            log.log(rootCtx, 'got invalid message from client', data);
            this.sendRaw(encodeInvalidMessage(makeInvalidMessage({ })));
            this.close();
        }
    }

    private onSocketClose() {
        this.incomingData.complete();
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
