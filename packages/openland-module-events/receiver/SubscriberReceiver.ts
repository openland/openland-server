import { createLogger } from '@openland/log';
import { inTx } from '@openland/foundationdb';
import { createNamedContext } from '@openland/context';
import { backoff, delay } from 'openland-utils/timer';
import { NatsSubscription } from 'openland-module-pubsub/NATS';
import { EventsMediator } from './../mediators/EventsMediator';

const root = createNamedContext('subscriber');
const log = createLogger('feed-subscriber');

function random(min: number, max: number) {
    return Math.floor(min + Math.random() * (max - min));
}

export const ONLINE_REFRESH = 30 * 1000; // 30 Sec

export type SubscriberReceiverEvent =
    | {
        type: 'started',
        seq: number,
        state: Buffer
    }
    | {
        type: 'update',
        feed: Buffer,
        seq: number,
        pts: number,
        event: Buffer
    }
    | {
        type: 'update-ephemeral',
        feed: Buffer,
        seq: number,
        event: Buffer
    }
    | {
        type: 'subscribe',
        feed: Buffer,
        seq: number,
        fromPts: number
    }
    | {
        type: 'unsubscribe',
        feed: Buffer,
        seq: number,
        toPts: number
    }
    | {
        type: 'closed'
    };

type BusEvent = { seq: number, event: { type: 'subscribe' | 'unsubscribe' | 'update' | 'update-ephemeral', pts: number | null, vt: Buffer, feed: Buffer, event: Buffer | null } };

export type ReceiverOpts = {
    deathDelay: { min: number, max: number };
    checkpointDelay: { min: number, max: number };
    checkpointCommitDelay: number;
    checkpointMaxUpdates: number;
};

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
    private opts: ReceiverOpts;

    constructor(
        subscriber: Buffer,
        mediator: EventsMediator,
        handler: (e: SubscriberReceiverEvent) => void,
        opts: ReceiverOpts
    ) {
        this.subscriber = subscriber;
        this.mediator = mediator;
        this.handler = handler;
        this.opts = opts;
        // console.warn(subscriber);
        this.subscription = mediator.bus.subscribe('events-subscriber-' + subscriber.toString('hex').toLowerCase(), (e) => {
            // console.warn(e);
            let event = {
                seq: e.seq as number,
                event: {
                    pts: e.event.pts as number | null,
                    vt: Buffer.from(e.event.vt as string, 'base64'),
                    type: e.event.type as 'subscribe' | 'unsubscribe' | 'update',
                    feed: Buffer.from(e.event.feed as string, 'base64'),
                    event: e.event.event ? Buffer.from(e.event.event as string, 'base64') : null
                }
            };
            if (this.stopped) {
                return;
            }
            log.log(root, event);
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
                await mediator.refreshOnline(ctx, subscriber);
                return (await mediator.repo.getState(ctx, subscriber));
            });
            let state = rawState.vt.resolved.value;
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

        // NATS subscription
        this.subscription.cancel();

        // Death timer
        if (this.deathTimer) {
            clearTimeout(this.deathTimer);
            this.deathTimer = null;
        }

        this.handler({ type: 'closed' });
    }

    private handleStart = (state: Buffer, seq: number) => {
        this.started = true;
        this.handler({ type: 'started', state, seq: seq });
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
                await this.mediator.refreshOnline(root, this.subscriber);
                await delay(ONLINE_REFRESH);
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
        if (this.stopped) {
            return;
        }
        if (this.deathTimer) {
            clearTimeout(this.deathTimer);
            this.deathTimer = null;
        }
    }

    private startDeathTimer = () => {
        if (this.stopped) {
            return;
        }
        if (!this.deathTimer) {
            this.deathTimer = setTimeout(this.close, random(this.opts.deathDelay.min, this.opts.deathDelay.max));
        }
    }

    private processEvent(src: BusEvent) {
        // Call handler
        if (src.event.type === 'update') {
            this.handler({ type: 'update', feed: src.event.feed, seq: src.seq, pts: src.event.pts!, event: src.event.event! });
        } else if (src.event.type === 'update-ephemeral') {
            this.handler({ type: 'update-ephemeral', feed: src.event.feed, seq: src.seq, event: src.event.event! });
        } else if (src.event.type === 'subscribe') {
            this.handler({ type: 'subscribe', feed: src.event.feed, seq: src.seq, fromPts: src.event.pts! });
        } else if (src.event.type === 'unsubscribe') {
            this.handler({ type: 'unsubscribe', feed: src.event.feed, seq: src.seq, toPts: src.event.pts! });
        }
    }
}