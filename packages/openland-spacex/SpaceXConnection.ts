import { randomKey } from '../openland-utils/random';
import WebSocket from 'ws';
import { SpaceXSession } from './SpaceXSession';
import { Metrics } from '../openland-module-monitoring/Metrics';
import { Concurrency } from '../openland-server/concurrency';
import uuid from 'uuid';
import { PingPong } from './PingPong';
import os from 'os';
const hostname = os.hostname();

export class SpaceXConnection {
    readonly id = randomKey();
    public protocolVersion = 1;
    private socket: WebSocket | null;
    public createdAt = Date.now();
    public state: 'init' | 'connecting' | 'connected' = 'init';
    public pinger: PingPong | null = null;
    public authParams: any;
    public session!: SpaceXSession;
    private closed = false;
    private authWaiters: (() => void)[] = [];
    public lastRequestTime: number = Date.now();
    public operationBucket = Concurrency.Operation.get(this.id);
    // Maps protocol operation ids to SpaceXSession ids
    readonly sessionOperationIds = new Map<string, string>();

    private onClose: () => void = () => 0;

    constructor(socket: WebSocket, onClose: () => void) {
        this.socket = socket;
        this.onClose = onClose;
        Metrics.WebSocketConnections.inc();
        Metrics.WebSocketConnectionsProcess.inc(hostname);
    }

    setConnecting = () => {
        this.state = 'connecting';
    }

    setConnected = () => {
        if (this.state !== 'connected') {
            this.state = 'connected';
            this.authWaiters.map(v => v());
        }
    }

    sendConnectionAck = () => this.send({ type: 'connection_ack' });

    isConnected = () => this.socket && this.socket!.readyState === WebSocket.OPEN && this.state === 'connected';

    sendKeepAlive = () => this.send({ type: 'ka' });

    send = (data: any) => {
        if (this.socket) {
            Metrics.WebSocketPacketsOut.inc();
            this.socket.send(JSON.stringify(data));
        }
    }

    sendData = (id: string, payload: any) => this.send({ id, type: 'data', payload });

    sendComplete = (id: string) => this.send({ id, type: 'complete', payload: null });

    sendRateLimitError = (id: string) => this.sendData(id, {
        data: null,
        errors: [{
            message: 'An unexpected error occurred. Please, try again. If the problem persists, please contact support@openland.com.',
            uuid: uuid(),
            shouldRetry: true
        }]
    })

    close = () => {
        if (this.closed) {
            return;
        }
        this.closed = true;
        this.pinger?.terminate();
        this.socket?.close();
        this.socket?.removeAllListeners('message');
        this.socket?.removeAllListeners('close');
        this.socket?.removeAllListeners('error');
        this.socket = null;
        this.session?.close();
        Metrics.WebSocketConnections.dec();
        Metrics.WebSocketConnectionsProcess.dec(hostname);
        this.onClose();
    }

    waitAuth = async () => {
        if (this.state === 'connected') {
            return;
        }
        await new Promise<void>(resolve => {
            this.authWaiters.push(resolve);
        });
    }
}