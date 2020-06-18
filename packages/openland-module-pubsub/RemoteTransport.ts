import { Subscription, Client } from 'ts-nats';
import uuid from 'uuid/v4';
import { asyncRun } from 'openland-mtproto3/utils';

export class RemoteTransport {
    readonly id = uuid();

    onMessage: ((body: any) => void) | undefined;
    onClosed: (() => void) | undefined;

    private readonly keepAlive: number;
    private readonly client: Client;
    private subscription: Subscription | null = null;
    private status: 'init' | 'started' | 'connected' | 'stopped' = 'init';
    private received = new Map<number, any>();
    private receivedProcessedSeq: number = -1;
    private receivedSeq: number = -1;
    private retryTimer: NodeJS.Timer | null = null;

    private sentSeq: number = -1;
    private keepAliveTimer: NodeJS.Timer | null = null;
    private timeoutTimer: NodeJS.Timer | null = null;
    private remoteId: string | null = null;

    constructor(opts: { client: Client, keepAlive: number }) {
        this.keepAlive = opts.keepAlive;
        this.client = opts.client;
    }

    async start() {
        if (this.status !== 'init') {
            throw Error('Already started');
        }
        this.status = 'started';
        this.subscription = await this.client.subscribe(`streams.${this.id}`, (_, msg) => {
            if (!msg.data) {
                return;
            }

            // Reset timeout
            this.timeoutTimer = setTimeout(() => {
                if (this.onClosed) {
                    this.onClosed();
                }
                this.stop();
            }, 5000);

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
                if (this.remoteId) {
                    let seq = msg.data.seq as number;
                    this.onReceivedSeq(seq);
                }
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
                        let response = await this.client.request(`streams.${this.remoteId}`, 5000, { seq });
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
                            if (this.onClosed) {
                                this.onClosed();
                            }
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

    private onReceived = (body: any) => {
        if (this.onMessage) {
            this.onMessage(body);
        }
    }

    private handleMessage = (seq: number, body: any) => {
        if (this.receivedProcessedSeq + 1 === seq) {
            this.receivedProcessedSeq++;
            this.onReceived(body);
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
            this.onReceived(value);
        }
    }

    connect(remoteId: string) {
        if (this.status !== 'started') {
            throw Error('Already connected');
        }
        this.status = 'connected';
        this.remoteId = remoteId;

        // Keep Alive
        this.keepAliveTimer = setInterval(() => {
            this.client.publish(`streams.${remoteId}`, {
                type: 'ka',
                seq: this.sentSeq
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

        // Timeout
        this.timeoutTimer = setTimeout(() => {
            if (this.onClosed) {
                this.onClosed();
            }
            this.stop();
        }, 5000);
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
        if (this.timeoutTimer) {
            clearTimeout(this.timeoutTimer);
            this.timeoutTimer = null;
        }
    }
}