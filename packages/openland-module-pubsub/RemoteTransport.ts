import uuid from 'uuid/v4';
import { Subscription, Client } from 'ts-nats';
import { asyncRun } from 'openland-mtproto3/utils';
import { debounce } from '../openland-utils/timer';
import EventEmitter from 'events';

//
// TODO: Make Transport, Tunnel and separate Connections:
// Transport is managing ONE subscription for machine and notifying tunnels about new messages
// > transport should create tunnel if it recieves conn_neg event
//
// Tunnel is managing keep-alive events (watchdog) and counts how many connections are referenced
// > if references count becomes 0 it should stop sending keep alives
//
// Connection is managing acks, nacks and sends messages through tunnel, it is like frontend for our transport
// > connection should hold received and sent messages and count seq
//
// Connection is managing acks and nacks because it could fail some messages if there are many connections in tunnel
//
export class RemoteTransport extends EventEmitter {
    readonly id = uuid();

    private readonly keepAlive: number;
    private readonly timeout: number;
    private readonly client: Client;
    private subscription: Subscription | null = null;
    private status: 'init' | 'started' | 'connected' | 'stopped' = 'init';
    private received = new Map<number, any>();
    private receivedProcessedSeq: number = -1;
    private receivedSeq: number = -1;
    private retryTimer: NodeJS.Timer | null = null;

    private sentSeq: number = -1;
    private keepAliveTimer: NodeJS.Timer | null = null;
    private kickWatchDog: (() => void) | null = null;
    private remoteId: string | null = null;
    private sent = new Map<number, any>();

    constructor(opts: { client: Client, keepAlive: number, timeout?: number }) {
        super();

        this.keepAlive = opts.keepAlive;
        this.timeout = opts.timeout || 5000;
        this.client = opts.client;
    }

    async start() {
        if (this.status !== 'init') {
            throw Error('Already started');
        }
        this.status = 'started';
        this.kickWatchDog = debounce(this.timeout, () => {
            if (this.status === 'stopped') {
                return;
            }
            this.notifyOnClosed();

            this.stop();
        });

        this.subscription = await this.client.subscribe(`streams.${this.id}`, (_, msg) => {
            if (!msg.data) {
                return;
            }
            // kick watch dog
            this.kickWatchDog!();

            if (msg.data.type === 'msg') {
                let body = msg.data.body as any;
                let seq = msg.data.seq as number;
                // Ignore invalid seq
                if (seq < 0) {
                    return;
                }
                if (this.remoteId) {
                    this.handleMessage(seq, body);
                    this.onReceivedSeq(seq); // After handle message
                } else {
                    // Not connected yet: save in receive buffer
                    if (!this.received.has(seq)) {
                        this.received.set(seq, body);
                    }
                }
            } else if (msg.data.type === 'ka') {
                // do nothing, used only for kicking watchdog
            } else if (msg.data.type === 'ack') {
                let seq = msg.data.seq as number;
                let body = this.sent.get(seq);
                if (body) {
                    this.sent.delete(seq);
                }
            } else if (msg.data.type === 'nack') {
                let seq = msg.data.seq as number;
                let body = this.sent.get(seq);
                if (body) {
                    this.client.publish(msg.reply!, { body, seq });
                }
            } else if (msg.data.type === 'stop') {
                this.remoteId = null;
                this.notifyOnClosed();
                this.stop();
            }
        });
    }

    private onAllPendingProcessed() {
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }
        this.startRetryTimerIfNeeded();
    }

    private startRetryTimerIfNeeded() {
        if (!this.retryTimer) {
            if (this.receivedProcessedSeq === this.receivedSeq) {
                return;
            }
            let seq = this.receivedSeq + 1;
            this.retryTimer = setTimeout(() => {
                asyncRun(async () => {
                    try {
                        let response = await this.client.request(`streams.${this.remoteId}`, 5000, { type: 'nack', seq });
                        if (this.status === 'stopped') {
                            return;
                        }
                        this.handleMessage(response.data.seq, response.data.body);
                    } catch (e) {
                        if (this.status === 'stopped') {
                            return;
                        }
                        if (this.receivedSeq + 1 === seq) {
                            // Still not moved: Do abort
                            this.notifyOnClosed();
                            this.stop();
                        }
                    }
                });
            }, 1000);
        }
    }

    private onReceivedSeq = (seq: number) => {
        this.receivedSeq = Math.max(this.receivedSeq, seq);
        if (this.receivedProcessedSeq === this.receivedSeq) {
            return;
        }
        this.startRetryTimerIfNeeded();
    }

    private onReceived = (seq: number, body: any) => {
        this.notifyOnMessage(body);
        this.client.publish(`streams.${this.remoteId}`, {
            type: 'ack',
            seq: seq
        });
    }

    private handleMessage = (seq: number, body: any) => {
        if (this.receivedProcessedSeq + 1 === seq) {
            this.receivedProcessedSeq++;
            this.onReceived(seq, body);
            this.flushIfNeeded();
            this.onAllPendingProcessed();
        } else if (this.receivedProcessedSeq + 1 < seq) {
            // Save for later
            if (!this.received.has(seq)) {
                this.received.set(seq, body);
            }
        }
    }

    private flushIfNeeded = () => {
        while (this.received.has(this.receivedProcessedSeq + 1)) {
            let value = this.received.get(this.receivedProcessedSeq + 1)!;
            this.receivedProcessedSeq++;
            this.onReceived(this.receivedProcessedSeq, value);
        }
    }

    connect(remoteId: string) {
        if (this.status === 'init' || this.status === 'stopped') {
            throw Error('Not started');
        }
        if (this.status === 'connected') {
            throw Error('Already connected');
        }
        this.status = 'connected';
        this.remoteId = remoteId;

        // Keep Alive
        this.keepAliveTimer = setInterval(() => {
            this.client.publish(`streams.${this.remoteId}`, {
                type: 'ka',
            });
        }, this.keepAlive);

        // Flush pending
        this.flushIfNeeded();

        // Handle seqs (note: after flushing to avoid retries)
        for (let seq of this.received.keys()) {
            this.onReceivedSeq(seq);
        }

        // Handle retry timer
        this.onAllPendingProcessed();

        // Kick keep-alive watchdog
        this.kickWatchDog!();
    }

    send(body: any) {
        if (this.status !== 'connected') {
            throw Error('Not connected yet');
        }
        this.sentSeq++;
        let seq = this.sentSeq;
        this.sent.set(seq, body);
        this.client.publish(`streams.${this.remoteId}`, {
            type: 'msg',
            seq,
            body
        });
    }

    stop() {
        if (this.status === 'stopped') {
            throw Error('Already stopped');
        }
        this.status = 'stopped';
        if (this.subscription) {
            this.subscription.unsubscribe();
            this.subscription = null;
        }
        if (this.keepAliveTimer) {
            clearInterval(this.keepAliveTimer);
            this.keepAliveTimer = null;
        }
        if (this.remoteId) {
            this.client.publish(`streams.${this.remoteId}`, {
                type: 'stop'
            });
            this.remoteId = null;
        }
        if (this.retryTimer) {
            clearTimeout(this.retryTimer);
            this.retryTimer = null;
        }
        this.removeAllListeners('closed');
        this.removeAllListeners('message');
    }

    //
    // Subscriptions
    //
    private notifyOnMessage(body: any) {
        this.emit('message', body);
    }
    private notifyOnClosed() {
        this.emit('closed');
    }
    onMessage(handler: (body: any) => void) {
        this.on('message', handler);
    }
    onClosed(handler: () => void) {
        this.on('closed', handler);
    }
}