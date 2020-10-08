import { inTx } from '@openland/foundationdb';
import { BufferMap } from './../utils/BufferMap';
import { createNamedContext } from '@openland/context';
import { backoff, delay } from 'openland-utils/timer';
import { NATS, NatsSubscription } from 'openland-module-pubsub/NATS';
import { EventsMediator } from './../mediators/EventsMediator';

const root = createNamedContext('subscriber');

const ONLINE_EXPIRES = 5 * 60 * 1000; // 5 Min

export type SubscriberReceiverEvent =
    | {
        type: 'started',
        state: Buffer
    }
    | {
        type: 'update',
        feed: Buffer,
        seq: number,
        event: Buffer
    }
    | {
        type: 'subscribe',
        feed: Buffer,
        fromSeq: number
    }
    | {
        type: 'unsubscribe',
        feed: Buffer,
        toSeq: number
    }
    | {
        type: 'checkpoint',
        state: Buffer,
    }
    | {
        type: 'closed'
    };

type BusEvent = { seq: number, event: { type: 'subscribe' | 'unsubscribe' | 'update', seq: number, state: Buffer, feed: Buffer, event: Buffer | null } };

export class SubscriberReceiver {
    private subscriber: Buffer;
    private mediator: EventsMediator;
    private subscription: NatsSubscription;
    private handler: (e: SubscriberReceiverEvent) => void;
    private stopped = false;
    private started = false;
    private pending = new Map<number, BusEvent>();
    private currentSeq: number = -1;
    private deathTimer: NodeJS.Timer | null = null;
    private receivedChanges = new BufferMap<Buffer>();

    constructor(subscriber: Buffer, mediator: EventsMediator, handler: (e: SubscriberReceiverEvent) => void) {
        this.subscriber = subscriber;
        this.mediator = mediator;
        this.handler = handler;
        this.subscription = NATS.subscribe('events-subscriber-' + subscriber.toString('hex').toLowerCase(), (e) => {
            let event = {
                seq: e.data.seq as number,
                event: {
                    seq: e.data.event.seq as number,
                    state: Buffer.from(e.data.event.state as string, 'base64'),
                    type: e.data.event.type as 'subscribe' | 'unsubscribe' | 'update',
                    feed: Buffer.from(e.data.event.feed as string, 'base64'),
                    event: e.data.event.event ? Buffer.from(e.data.event.event as string, 'base64') : null
                }
            };
            if (this.stopped) {
                return;
            }
            this.receiveEvent(event);
        });

        // tslint:disable-next-line:no-floating-promises
        backoff(root, async () => {
            if (this.stopped) {
                return;
            }
            if (this.started) {
                return;
            }
            let rawState = await inTx(root, async (ctx) => {
                let r = (await mediator.repo.getState(ctx, subscriber));
                await mediator.repo.refreshOnline(ctx, subscriber, ONLINE_EXPIRES);
                return r;
            });
            let state = await rawState.state;
            let seq = rawState.seq;
            if (this.stopped) {
                return;
            }
            if (this.started) {
                return;
            }
            this.handleStart(state, seq);
        });
    }

    close = () => {
        if (this.stopped) {
            return;
        }
        this.stopped = true;
        this.subscription.cancel();
        this.handler({ type: 'closed' });
    }

    private handleStart = (state: Buffer, seq: number) => {
        this.started = true;
        this.handler({ type: 'started', state });
        this.currentSeq = seq;
        this.flushPending();

        // Start death timer right after start
        // if we have pending (or missing) messages
        if (this.pending.size > 0) {
            this.startDeathTimer();
        }

        // Start refresh online loop
        // tslint:disable-next-line:no-floating-promises
        backoff(root, async () => {
            while (!this.stopped) {
                await this.mediator.repo.refreshOnline(root, this.subscriber, ONLINE_EXPIRES);
                await delay(30000);
            }
        });
    }

    private flushPending = () => {

        // Flush pending if possible
        while (this.pending.has(this.currentSeq + 1)) {
            let e = this.pending.get(this.currentSeq + 1)!;
            this.pending.delete(this.currentSeq + 1);
            this.currentSeq++;
            this.processEvent(e);
        }

        // Delete old pending
        for (let k of [...this.pending.keys()]) {
            if (k <= this.currentSeq) {
                this.pending.delete(k);
            }
        }
    }

    private receiveEvent = (event: BusEvent) => {

        // Not yet started
        if (!this.started) {
            if (this.pending.has(event.seq)) {
                return;
            }
            this.pending.set(event.seq, event);
            return;
        }

        // Started
        if (event.seq === this.currentSeq + 1) {
            this.currentSeq++;
            this.processEvent(event);
            this.cancelDeathTimer();
            this.flushPending();
        } else if (event.seq > this.currentSeq) {
            this.pending.set(event.seq, event);
            this.startDeathTimer();
        } else {
            // Just ignore
        }
    }

    private cancelDeathTimer = () => {
        if (this.deathTimer) {
            clearTimeout(this.deathTimer);
            this.deathTimer = null;
        }
    }

    private startDeathTimer = () => {
        if (!this.deathTimer) {
            this.deathTimer = setTimeout(this.close, 10000);
        }
    }

    private processEvent(src: BusEvent) {

        // Save latest if event new
        let ex = this.receivedChanges.get(src.event.feed);
        if (!ex || Buffer.compare(ex, src.event.state) < 0) {
            this.receivedChanges.set(src.event.feed, src.event.state);
        }

        // Call handler
        if (src.event.type === 'update') {
            this.handler({ type: 'update', feed: src.event.feed, seq: src.event.seq, event: src.event.event! });
        } else if (src.event.type === 'subscribe') {
            this.handler({ type: 'subscribe', feed: src.event.feed, fromSeq: src.event.seq });
        } else if (src.event.type === 'unsubscribe') {
            this.handler({ type: 'unsubscribe', feed: src.event.feed, toSeq: src.event.seq });
        }
    }
}