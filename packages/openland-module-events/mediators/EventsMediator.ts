import { inTx, getTransaction } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { EventsRepository } from './../repo/EventsRepository';
import { NATS } from 'openland-module-pubsub/NATS';

const DIRECT_LIMIT = 100;

export class EventsMediator {
    repo: EventsRepository;

    constructor(repo: EventsRepository) {
        this.repo = repo;
    }

    createFeed(ctx: Context) {
        return this.repo.createFeed(ctx);
    }

    createSubscriber(ctx: Context) {
        return this.repo.createSubscriber(ctx);
    }

    async subscribe(parent: Context, subscriber: Buffer, feed: Buffer, strict: boolean) {
        await inTx(parent, async (ctx) => {
            let mode: 'direct' | 'async' = 'direct';
            if (!strict) {
                let directSubscribers = await this.repo.getFeedDirectSubscribersCount(ctx, feed);
                if (directSubscribers > DIRECT_LIMIT) {
                    mode = 'async';
                }
            }
            let res = await this.repo.subscribe(ctx, subscriber, feed, { mode: mode, strict });
            if (await this.repo.isOnline(ctx, subscriber, Date.now())) {
                // NOTE: We MUST execute this within transaction to have strict delivery guarantee
                let seq = (await this.repo.allocateSubscriberSeq(ctx, [subscriber]))[0];
                getTransaction(ctx).afterCommit(async () => {
                    let state = await res.state;
                    this.postToBus(subscriber, seq, { feed, type: 'subscribe', seq: res.seq, state, event: null });
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
                getTransaction(ctx).afterCommit(async () => {
                    let state = await res.state;
                    this.postToBus(subscriber, seq, { feed, type: 'unsubscribe', seq: res.seq, state, event: null });
                });
            }
        });
    }

    async post(parent: Context, feed: Buffer, event: Buffer) {
        await inTx(parent, async (ctx) => {
            let posted = await this.repo.post(ctx, { feed, event });
            let online = await this.repo.getFeedOnlineSubscribers(ctx, feed, Date.now());
            if (online.length > 0) {
                // NOTE: This allocation COULD be executed in separate transaction
                //       we allow missing or reordered updates on receiving side.
                let seqs = await this.repo.allocateSubscriberSeq(ctx, online);
                getTransaction(ctx).afterCommit(async () => {
                    let state = await posted.state;
                    for (let i = 0; i < seqs.length; i++) {
                        this.postToBus(online[i], seqs[i], { feed, type: 'update', seq: posted.seq, state, event });
                    }
                });
            }
        });
    }

    private postToBus(subscriber: Buffer, seq: number, event: {
        feed: Buffer,
        type: 'subscribe' | 'unsubscribe' | 'update',
        seq: number,
        state: Buffer,

        event: Buffer | null
    }) {
        NATS.post('events-subscriber-' + subscriber.toString('hex').toLowerCase(), {
            seq,
            event: {
                feed: event.feed.toString('base64'),
                seq: event.seq,
                state: event.state.toString('base64'),
                type: event.type,
                ...(event.event ? { event: event.event.toString('base64') } : {})
            }
        });
    }
}