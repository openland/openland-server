import { createIterator } from '../../openland-utils/asyncIterator';
import { delay } from '../../openland-utils/timer';
import { encodePing, isPong, KnownTypes, makePing } from '../vostok-schema/VostokTypes';
import { PING_CLOSE_TIMEOUT, PING_TIMEOUT } from './vostok';
import WebSocket = require('ws');
import { createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';
import { asyncRun } from '../utils';

const rootCtx = createNamedContext('vostok');
const log = createLogger('vostok');

export class VostokConnection {
    protected socket: WebSocket|null = null;
    protected incomingData = createIterator<any>(() => 0);

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
        let msgData = JSON.parse(data.toString());
        if (isPong(msgData)) {
            this.lastPingAck = Date.now();
            this.pingAckCounter++;
        } else {
            this.incomingData.push(msgData);
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
