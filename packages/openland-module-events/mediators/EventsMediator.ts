import { EventBusEngine } from 'openland-module-pubsub/EventBusEngine';
import { SubscriberReceiver, SubscriberReceiverEvent, ReceiverOpts } from './../receiver/SubscriberReceiver';
import { inTx, getTransaction } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { EventsRepository } from './../repo/EventsRepository';

const DIRECT_LIMIT = 100;

const DEATH_TIMEOUT_MIN = 10 * 1000; // 10 Sec
const DEATH_TIMEOUT_MAX = 20 * 1000; // 20 Sec
const CHECKPOINT_INTERVAL_MIN = 10 * 1000; // 10 Sec
const CHECKPOINT_INTERVAL_MAX = 20 * 1000; // 10 Sec
const CHECKPOINT_MAX_UPDATES = 10;
const CHECKPOINT_COMMIT_DELAY = 30 * 1000; // 30 Sec

const ONLINE_EXPIRES = 5 * 60 * 1000; // 5 Min
const ONLINE_GAP = 1 * 60 * 1000; // 1 Min

export class EventsMediator {
    readonly repo: EventsRepository;
    readonly bus: EventBusEngine;

    constructor(repo: EventsRepository, bus: EventBusEngine) {
        this.repo = repo;
        this.bus = bus;
    }

    createFeed(ctx: Context, mode: 'forward-only' | 'generic') {
        return this.repo.createFeed(ctx, mode);
    }

    createSubscriber(ctx: Context) {
        return this.repo.createSubscriber(ctx);
    }

    async subscribe(parent: Context, subscriber: Buffer, feed: Buffer) {
        await inTx(parent, async (ctx) => {
            let mode: 'direct' | 'async' = 'direct';
            let feedMode = await this.repo.registry.getFeed(ctx, feed);
            if (feedMode === 'generic') {
                let directSubscribers = await this.repo.getFeedDirectSubscribersCount(ctx, feed);
                if (directSubscribers > DIRECT_LIMIT) {
                    mode = 'async';
                }
            }
            let res = await this.repo.subscribe(ctx, subscriber, feed, mode);
            if (await this.repo.isOnline(ctx, subscriber, Date.now())) {
                // NOTE: We MUST execute this within transaction to have strict delivery guarantee
                let seq = (await this.repo.allocateSubscriberSeq(ctx, [subscriber]))[0];
                let time = Date.now();
                getTransaction(ctx).afterCommit(async (tx) => {
                    let vt = res.vt.resolved.value;
                    this.postToBus(tx, subscriber, seq, { feed, time, type: 'subscribe', pts: res.seq, vt, event: null });
                });
            }
        });
    }

    async unsubscribe(parent: Context, subscriber: Buffer, feed: Buffer) {
        await inTx(parent, async (ctx) => {
            let res = await this.repo.unsubscribe(ctx, subscriber, feed);

            if (await this.repo.isOnline(ctx, subscriber, Date.now())) {
                // NOTE: We MUST execute this within transaction to have strict delivery guarantee
                let seq = (await this.repo.allocateSubscriberSeq(ctx, [subscriber]))[0];
                let time = Date.now();
                getTransaction(ctx).afterCommit(async (tx) => {
                    let vt = res.vt.resolved.value;
                    this.postToBus(tx, subscriber, seq, { feed, time, type: 'unsubscribe', pts: res.seq, vt, event: null });
                });
            }
        });
    }

    async post(parent: Context, args: { feed: Buffer, event: Buffer, collapseKey?: string | null | undefined }) {
        await inTx(parent, async (ctx) => {
            let posted = await this.repo.post(ctx, { feed: args.feed, event: args.event, collapseKey: args.collapseKey });
            let online = await this.repo.getFeedOnlineSubscribers(ctx, args.feed, Date.now());
            if (online.length > 0) {
                // NOTE: This allocation COULD be executed in separate transaction
                //       we allow missing or reordered updates on receiving side.
                let seqs = await this.repo.allocateSubscriberSeq(ctx, online);
                // NOTE: Time MUST be calculated in transaction
                let time = Date.now();
                getTransaction(ctx).afterCommit(async (tx) => {
                    let vt = posted.vt.resolved.value;
                    for (let i = 0; i < seqs.length; i++) {
                        this.postToBus(tx, online[i], seqs[i], { feed: args.feed, time, type: 'update', pts: posted.seq, vt, event: args.event });
                    }
                });
            }
        });
    }

    async postEphemeral(parent: Context, args: { feed: Buffer, subscriber: Buffer, event: Buffer }) {
        await inTx(parent, async (ctx) => {
            let posted = await this.repo.postEphemeral(ctx, { feed: args.feed, subscriber: args.subscriber, event: args.event });
            if (await this.repo.isOnline(ctx, args.subscriber, Date.now())) {
                // NOTE: We MUST execute this within transaction to have strict delivery guarantee
                let seq = (await this.repo.allocateSubscriberSeq(ctx, [args.subscriber]))[0];
                let time = Date.now();
                getTransaction(ctx).afterCommit(async (tx) => {
                    let vt = posted.vt.resolved.value;
                    this.postToBus(tx, args.subscriber, seq, { feed: args.feed, time, type: 'update-ephemeral', pts: null, vt, event: args.event });
                });
            }
        });
    }

    receive(subscriber: Buffer, handler: (e: SubscriberReceiverEvent) => void, opts?: Partial<ReceiverOpts>) {
        return new SubscriberReceiver(subscriber, this, handler, {
            deathDelay: { min: DEATH_TIMEOUT_MIN, max: DEATH_TIMEOUT_MAX },
            checkpointDelay: { min: CHECKPOINT_INTERVAL_MIN, max: CHECKPOINT_INTERVAL_MAX },
            checkpointMaxUpdates: CHECKPOINT_MAX_UPDATES,
            checkpointCommitDelay: CHECKPOINT_COMMIT_DELAY,
            ...opts
        });
    }

    async refreshOnline(ctx: Context, subscriber: Buffer) {
        // If online expires soon (after ONLINE_GAP) - bump seq number to trigger forced difference
        if (!(await this.repo.isOnline(ctx, subscriber, Date.now() + ONLINE_GAP))) {
            await this.repo.subSeq.allocateBlock(ctx, subscriber, 10);
        }

        await this.repo.refreshOnline(ctx, subscriber, Date.now() + ONLINE_EXPIRES);
    }

    private postToBus(ctx: Context, subscriber: Buffer, seq: number, event: {
        feed: Buffer,
        type: 'subscribe' | 'unsubscribe' | 'update' | 'update-ephemeral',
        pts: number | null,
        vt: Buffer,
        event: Buffer | null,
        time: number
    }) {
        let toPost = {
            seq,
            event: {
                feed: event.feed.toString('base64'),
                pts: event.pts,
                vt: event.vt.toString('base64'),
                type: event.type,
                time: event.time,
                ...(event.event ? { event: event.event.toString('base64') } : {})
            }
        };
        this.bus.publish('events-subscriber-' + subscriber.toString('hex').toLowerCase(), toPost);
    }
}