import { SubscriberUpdatesRepository } from './internal/SubscriberUpdatesRepository';
import { BufferSet } from './internal/BufferSet';
import { Locations } from './internal/Locations';
import { SubscriberRepository } from './internal/SubscriberRepository';
import { SubscriberDirectRepository } from './internal/SubscriberDirectRepository';
import { SubscriberAsyncRepository } from './internal/SubscriberAsyncRepository';
import { SubscriberSeqRepository } from './internal/SubscriberSeqRepository';
import { Context } from '@openland/context';
import { VersionStampRepository } from './internal/VersionStampRepository';
import { RegistryRepository } from './internal/RegistryRepository';
import { Subspace, inTxLeaky } from '@openland/foundationdb';
import { FeedSeqRepository } from './internal/FeedSeqRepository';
import { FeedEventsRepository } from './internal/FeedEventsRepository';
import { FeedLatestRepository } from './internal/FeedLatestRepository';

const ONE = Buffer.from([1]);

export class EventsRepository {
    readonly subspace: Subspace;

    readonly feedLatest: FeedLatestRepository;
    readonly feedEvents: FeedEventsRepository;
    readonly feedSeq: FeedSeqRepository;

    readonly sub: SubscriberRepository;
    readonly subUpdated: SubscriberUpdatesRepository;
    readonly subSeq: SubscriberSeqRepository;
    readonly subAsync: SubscriberAsyncRepository;
    readonly subDirect: SubscriberDirectRepository;

    readonly vts: VersionStampRepository;
    readonly registry: RegistryRepository;

    constructor(subspace: Subspace) {
        this.subspace = subspace;
        this.feedLatest = new FeedLatestRepository(subspace);
        this.feedEvents = new FeedEventsRepository(subspace);
        this.feedSeq = new FeedSeqRepository(subspace);
        this.registry = new RegistryRepository(subspace);
        this.subSeq = new SubscriberSeqRepository(subspace);
        this.sub = new SubscriberRepository(subspace);
        this.subAsync = new SubscriberAsyncRepository(subspace);
        this.subDirect = new SubscriberDirectRepository(subspace);
        this.subUpdated = new SubscriberUpdatesRepository(subspace);
        this.vts = new VersionStampRepository(subspace.db);
    }

    //
    // Feed/Subscriber
    //

    async createFeed(parent: Context) {
        return await inTxLeaky(parent, async (ctx) => {

            // Allocate feed id
            let feed = await this.registry.allocateFeedId(ctx);

            // Set initial seq
            let seq = 0;
            this.feedSeq.setSeq(ctx, feed, seq);

            // Set initial latest
            let index = this.vts.allocateVersionstampIndex(ctx);
            await this.feedLatest.writeLatest(ctx, feed, seq, index);

            return feed;
        });
    }

    async createSubscriber(parent: Context) {
        return await inTxLeaky(parent, async (ctx) => {
            let subs = await this.registry.allocateSubscriberId(ctx);
            return subs;
        });
    }

    async subscribe(parent: Context, subscriber: Buffer, feed: Buffer, opts: { mode: 'direct' | 'async', strict: boolean }) {
        return await inTxLeaky(parent, async (ctx) => {
            if (!(await this.registry.subscriberExists(ctx, subscriber))) {
                throw Error('Unable to find subscriber');
            }
            if (!(await this.registry.feedExists(ctx, feed))) {
                throw Error('Unable to find feed');
            }

            // Read feed sequence
            let seq = (await this.feedSeq.getSeq(ctx, feed));
            let index = this.vts.allocateVersionstampIndex(ctx);

            // Add subscription
            // NOTE: This method checks for correctness
            await this.sub.addSubscription(ctx, subscriber, feed, opts.mode, opts.strict, seq);

            // Write to updated list
            await this.subUpdated.appendChanged(ctx, subscriber, feed, index);

            // Add to specific collection
            if (opts.mode === 'async') {
                await this.subAsync.addSubscriber(ctx, subscriber, feed);
            } else if (opts.mode === 'direct') {
                await this.subDirect.addSubscriber(ctx, subscriber, feed);
            } else {
                throw Error('Unknown mode: ' + opts.mode);
            }
        });
    }

    async getSubscriberFeeds(parent: Context, subscriber: Buffer) {
        return await inTxLeaky(parent, async (ctx) => {
            return await this.sub.getSubscriptions(ctx, subscriber);
        });
    }

    //
    // Posting
    //

    async post(parent: Context, args: { feed: Buffer, event: Buffer }) {
        return await inTxLeaky(parent, async (ctx) => {

            // Allocate Seq
            let seq = await this.feedSeq.allocateSeq(ctx, args.feed);

            // Allocate index
            let index = this.vts.allocateVersionstampIndex(ctx);

            // Write event to a stream
            await this.feedEvents.writeEvent(ctx, args.feed, args.event, seq, index);

            // Write latest reference
            await this.feedLatest.writeLatest(ctx, args.feed, seq, index);

            // Update direct references
            await this.subDirect.setUpdatedReference(ctx, args.feed, seq, index);

            return { seq };
        });
    }

    async getState(parent: Context, subscriber: Buffer) {
        return await inTxLeaky(parent, async (ctx) => {

            // NOTE: We are adding dump write to enforce transaction commit and 
            //       resolving of a version stamp
            this.subspace.add(ctx, Locations.subscriber.subscriptionVt(subscriber), ONE);

            // Resolve current seq
            let seq = await this.subSeq.getCurrentSeq(ctx, subscriber);

            // Resolve current state
            let index = this.vts.allocateVersionstampIndex(ctx);

            return { seq, state: this.vts.resolveVersionstamp(ctx, index).promise };
        });
    }

    async getChangedFeeds(parent: Context, subscriber: Buffer, after: Buffer) {
        return await inTxLeaky(parent, async (ctx) => {
            let set = new BufferSet();
            let changed: Buffer[] = [];

            // Changed subscription states
            let changedSubscriptions = await this.subUpdated.getChanged(ctx, subscriber, after);
            for (let ch of changedSubscriptions) {
                if (!set.has(ch)) {
                    set.add(ch);
                    changed.push(ch);
                }
            }

            // Direct subscriptions
            let changedDirect = (await this.subDirect.getUpdatedFeeds(ctx, subscriber, after)).map((v) => v.feed);
            for (let ch of changedDirect) {
                if (!set.has(ch)) {
                    set.add(ch);
                    changed.push(ch);
                }
            }

            // Async subscriptions
            let asyncSubscriptions = await this.subAsync.getSubscriberFeeds(ctx, subscriber);
            let asyncHeads = await Promise.all(asyncSubscriptions.map(async (feed) => ({ latest: await this.feedLatest.readLatest(ctx, feed), feed })));
            for (let h of asyncHeads) {
                if (Buffer.compare(after, h.latest.state) < 0) {
                    let state = await this.sub.getSubscriptionState(ctx, subscriber, h.feed);
                    if (!state || state.to !== null) {
                        throw Error('Broken state');
                    }
                    if (h.latest.seq <= state.from) {
                        continue;
                    }
                    if (!set.has(h.feed)) {
                        set.add(h.feed);
                        changed.push(h.feed);
                    }
                }
            }

            return changed;
        });
    }

    //
    // Subscriber online
    //

    async isOnline(parent: Context, subscriber: Buffer, now: number) {
        let clamped = Math.floor(now / 1000);

        return await inTxLeaky(parent, async (ctx) => {
            return await this.subSeq.isOnline(ctx, subscriber, clamped);
        });
    }

    async refreshOnline(parent: Context, subscriber: Buffer, expires: number) {
        let clamped = Math.floor(expires / 1000);

        await inTxLeaky(parent, async (ctx) => {
            await this.subSeq.refreshOnline(ctx, subscriber, clamped);
            await this.subAsync.setSubscriberOnline(ctx, subscriber, clamped);
        });
    }

    async getFeedOnlineSubscribers(parent: Context, feed: Buffer, now: number) {
        let clamped = Math.floor(now / 1000);

        return await inTxLeaky(parent, async (ctx) => {
            let directSubscribers = await this.subDirect.getFeedSubscribers(ctx, feed);
            let asyncOnlineSubscribers = await this.subAsync.getOnlineSubscribers(ctx, feed, clamped);

            let directWithOnline = await Promise.all(
                directSubscribers.map(
                    async (sub) => ({
                        sub,
                        online: await this.subSeq.isOnline(ctx, sub, clamped)
                    })
                ));
            return [...directWithOnline.filter((v) => v.online).map((v) => v.sub), ...asyncOnlineSubscribers];
        });
    }

    async allocateSubscriberSeq(parent: Context, subscribers: Buffer[]) {
        return await inTxLeaky(parent, async (ctx) => {
            return await Promise.all(subscribers.map((s) => this.subSeq.allocateSeq(ctx, s)));
        });
    }
}