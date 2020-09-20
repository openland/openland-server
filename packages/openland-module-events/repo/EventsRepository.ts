import { VersionStampRepository } from './internal/VersionStampRepository';
import { Context } from '@openland/context';
import { SeqRepository } from './internal/SeqRepository';
import { SubscriberRepository } from './internal/SubscriberRepository';
import { FeedRepository } from './internal/FeedRepository';
import { RegistryRepository } from './internal/RegistryRepository';
import { Subspace, inTxLeaky, encoders } from '@openland/foundationdb';

export type RawEvent = {
    seq: number,
    id: Buffer,
    event: Buffer
};

export class EventsRepository {

    private readonly feeds: FeedRepository;
    private readonly subscribers: SubscriberRepository;
    private readonly registry: RegistryRepository;
    private readonly seqnumbers: SeqRepository;
    private readonly vts: VersionStampRepository;

    constructor(directory: Subspace) {
        this.feeds = new FeedRepository(directory.subspace(encoders.tuple.pack([0])));
        this.registry = new RegistryRepository(directory.subspace(encoders.tuple.pack([2])));
        this.subscribers = new SubscriberRepository(directory.subspace(encoders.tuple.pack([1])));
        this.seqnumbers = new SeqRepository(directory.subspace(encoders.tuple.pack([3])));
        this.vts = new VersionStampRepository(directory.db);
    }

    //
    // Subscription management
    //

    async createFeed(parent: Context) {
        return await inTxLeaky(parent, async (ctx) => {
            let feed = await this.registry.allocateFeedId(ctx);

            // Set initial seq
            this.feeds.setSeq(ctx, feed, 0);

            // Set initial latest
            let index = this.vts.allocateVersionstampIndex(ctx);
            await this.feeds.writeLatest(ctx, feed, 0, index);

            return feed;
        });
    }

    async createSubscriber(parent: Context) {
        return await inTxLeaky(parent, async (ctx) => {
            let subscriber = this.registry.allocateSubscriberId(ctx);
            return subscriber;
        });
    }

    async getSubscriptionState(parent: Context, args: { subscriber: Buffer, feed: Buffer }) {
        return await inTxLeaky(parent, async (ctx) => {
            return await this.subscribers.getSubscriptionState(ctx, args.subscriber, args.feed);
        });
    }

    async subscribe(parent: Context, args: { subscriber: Buffer, feed: Buffer, mode: 'async' | 'direct' | 'direct-strict' }) {
        return await inTxLeaky(parent, async (ctx) => {
            if (args.mode === 'direct') {
                await this.subscribers.addDirectSubscription(ctx, args.subscriber, args.feed, false);
            } else if (args.mode === 'direct-strict') {
                await this.subscribers.addDirectSubscription(ctx, args.subscriber, args.feed, true);
            } else if (args.mode === 'async') {
                let index = this.vts.allocateVersionstampIndex(ctx);
                let seq = await this.feeds.getSeq(ctx, args.feed);
                await this.subscribers.addAsyncSubscription(ctx, args.subscriber, args.feed, seq, index);
            }
        });
    }

    async updateSubscribeMode(parent: Context, args: { subscriber: Buffer, feed: Buffer, mode: 'async' | 'direct' | 'direct-strict' }) {
        return await inTxLeaky(parent, async (ctx) => {
            let ex = await this.getSubscriptionState(ctx, { subscriber: args.subscriber, feed: args.feed });
            if (!ex) {
                throw Error('Subscription does not exist');
            }
            if (ex === args.mode) {
                return;
            }

            // Unsubscribe old
            await this.unsubscribe(ctx, { subscriber: args.subscriber, feed: args.feed });

            // Subscribe to new
            await this.subscribe(ctx, { subscriber: args.subscriber, feed: args.feed, mode: args.mode });
        });
    }

    async unsubscribe(parent: Context, args: { subscriber: Buffer, feed: Buffer }) {
        return await inTxLeaky(parent, async (ctx) => {
            await this.subscribers.removeSubscription(ctx, args.subscriber, args.feed);
            await this.subscribers.removeUpdatedReference(ctx, args.subscriber, args.feed);
        });
    }

    async getAsyncFeeds(parent: Context, subscriber: Buffer) {
        return await inTxLeaky(parent, async (ctx) => {
            return await this.subscribers.getAsyncFeeds(ctx, subscriber);
        });
    }

    async watchAsyncFeeds(parent: Context, subscriber: Buffer) {
        return await inTxLeaky(parent, async (ctx) => {
            return this.subscribers.watchAsyncSubscriptions(ctx, subscriber);
        });
    }

    async refreshSubscriberOnline(parent: Context, subscriber: Buffer, expires: number) {
        return await inTxLeaky(parent, async (ctx) => {
            await this.seqnumbers.refreshOnline(ctx, subscriber, expires);
        });
    }

    async getSubscriberSeq(parent: Context, subscriber: Buffer) {
        return await inTxLeaky(parent, async (ctx) => {
            return await this.seqnumbers.getCurrentSeq(ctx, subscriber);
        });
    }

    async getState(parent: Context, subscriber: Buffer) {
        return await inTxLeaky(parent, async (ctx) => {
            let index = this.vts.allocateVersionstampIndex(ctx);
            return { state: this.vts.resolveVersionstamp(ctx, index).promise };
        });
    }

    //
    // Posting
    //

    async post(parent: Context, args: { feed: Buffer, event: Buffer }) {
        return await inTxLeaky(parent, async (ctx) => {

            // Allocate Seq
            let seq = await this.feeds.allocateSeq(ctx, args.feed);

            // Allocate index
            let index = this.vts.allocateVersionstampIndex(ctx);

            // Write event to a stream
            await this.feeds.writeEvent(ctx, args.feed, args.event, seq, index);

            // Write latest reference
            await this.feeds.writeLatest(ctx, args.feed, seq, index);

            // Write feed change to update lists
            await this.subscribers.setUpdatedReference(ctx, args.feed, seq, index);

            // Delivery direct subscribers
            let now = Date.now();
            let directSubscribers = (await Promise.all(
                (await this.subscribers.getFeedDirectSubscribers(ctx, args.feed))
                    .map(async (subscriber) => ({
                        subscriber,
                        seq: await this.seqnumbers.allocateSeqIfOnline(ctx, subscriber, now)
                    }))
            )).filter((v) => v.seq !== null) as { subscriber: Buffer, seq: number }[];

            return { seq, subscribers: directSubscribers };
        });
    }

    async getFeedLatest(parent: Context, feed: Buffer) {
        return await inTxLeaky(parent, async (ctx) => {
            return await this.feeds.readLatest(ctx, feed);
        });
    }

    async getAsyncChanged(parent: Context, subscriber: Buffer, after: Buffer) {
        return await inTxLeaky(parent, async (ctx) => {
            return (await Promise.all(
                (await this.subscribers.getAsyncFeeds(ctx, subscriber))
                    .map(async (src) => {
                        let latest = await this.feeds.readLatest(ctx, src.id);
                        if (Buffer.compare(after, latest.state) < 0 && src.since.seq < latest.seq) {
                            return {
                                feed: src.id,
                                seq: latest.seq
                            };
                        } else {
                            return null;
                        }
                    }))
            ).filter((v) => !!v) as { feed: Buffer, seq: number }[];
        });
    }

    async getChanged(parent: Context, subscriber: Buffer, after: Buffer) {
        return await inTxLeaky(parent, async (ctx) => {

            // Changed Feeds
            let updatedDirect = await this.subscribers.getDirectUpdated(ctx, subscriber, after);
            let asyncFeeds = await this.getAsyncChanged(ctx, subscriber, after);

            // TODO: Changed subscriptions

            return { feeds: [...updatedDirect, ...asyncFeeds] };
        });
    }
}