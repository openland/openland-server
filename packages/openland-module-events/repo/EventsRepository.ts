import { StatsRepository } from './internal/StatsRepository';
import { SubscriberUpdatesRepository } from './internal/SubscriberUpdatesRepository';
import { BufferSet } from '../utils/BufferSet';
import { Locations } from './internal/Locations';
import { SubscriberRepository } from './internal/SubscriberRepository';
import { SubscriberDirectRepository } from './internal/SubscriberDirectRepository';
import { SubscriberAsyncRepository } from './internal/SubscriberAsyncRepository';
import { SubscriberSeqRepository } from './internal/SubscriberSeqRepository';
import { Context } from '@openland/context';
import { RegistryRepository } from './internal/RegistryRepository';
import { Subspace, inTxLeaky, createVersionstampRef } from '@openland/foundationdb';
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

    readonly registry: RegistryRepository;
    readonly stats: StatsRepository;

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
        this.stats = new StatsRepository(subspace);
    }

    //
    // Feed/Subscriber
    //

    async createFeed(parent: Context, mode: 'forward-only' | 'generic') {
        return await inTxLeaky(parent, async (ctx) => {

            // Allocate feed id
            let feed = await this.registry.allocateFeedId(ctx, mode);

            // Set initial seq
            let seq = 0;
            let vt = createVersionstampRef(ctx);

            this.feedSeq.setSeq(ctx, feed, seq);
            await this.feedLatest.writeLatest(ctx, feed, seq, vt);

            // Stats
            this.stats.increment(ctx, 'feeds');

            return feed;
        });
    }

    async createSubscriber(parent: Context) {
        return await inTxLeaky(parent, async (ctx) => {
            let subs = await this.registry.allocateSubscriberId(ctx);
            this.stats.increment(ctx, 'subscribers');
            return subs;
        });
    }

    async subscribe(parent: Context, subscriber: Buffer, feed: Buffer, mode: 'direct' | 'async') {
        return await inTxLeaky(parent, async (ctx) => {
            if (!(await this.registry.subscriberExists(ctx, subscriber))) {
                throw Error('Unable to find subscriber');
            }
            let feedMode = (await this.registry.getFeed(ctx, feed));
            if (!feedMode) {
                throw Error('Unable to find feed');
            }

            // Read feed sequence
            let seq = (await this.feedSeq.getSeq(ctx, feed));
            let vt = createVersionstampRef(ctx);

            // Add subscription
            // NOTE: This method checks for correctness
            await this.sub.addSubscription(ctx, subscriber, feed, mode, feedMode === 'forward-only', seq, vt.index);

            // Write to updated list
            await this.subUpdated.appendChanged(ctx, subscriber, feed, vt);

            // Add to specific collection
            if (mode === 'async') {
                let expires = await this.subSeq.getOnlineExpires(ctx, subscriber);
                await this.subAsync.addSubscriber(ctx, subscriber, feed, expires);
            } else if (mode === 'direct') {
                await this.subDirect.addSubscriber(ctx, subscriber, feed);
            } else {
                throw Error('Unknown mode: ' + mode);
            }

            // Stats
            this.stats.increment(ctx, 'subscriptions');

            return { seq, vt };
        });
    }

    async unsubscribe(parent: Context, subscriber: Buffer, feed: Buffer) {
        return await inTxLeaky(parent, async (ctx) => {
            if (!(await this.registry.subscriberExists(ctx, subscriber))) {
                throw Error('Unable to find subscriber');
            }
            if (!(await this.registry.getFeed(ctx, feed))) {
                throw Error('Unable to find feed');
            }

            // Read feed sequence
            let seq = (await this.feedSeq.getSeq(ctx, feed));
            let vt = createVersionstampRef(ctx);

            // Remove subscription
            // NOTE: This method checks for correctness
            let ex = await this.sub.removeSubscription(ctx, subscriber, feed, seq, vt.index);

            // Write to updated list
            await this.subUpdated.appendChanged(ctx, subscriber, feed, vt);

            // Update specific collections
            if (ex === 'direct') {
                await this.subDirect.removeSubscriber(ctx, subscriber, feed);
                let latest = await this.feedLatest.readFirstTransactionLatest(ctx, feed);
                if (latest) {
                    await this.subDirect.removeUpdatedReference(ctx, subscriber, feed, latest);
                }
            } else if (ex === 'async') {
                let expires = await this.subSeq.getOnlineExpires(ctx, subscriber);
                await this.subAsync.removeSubscriber(ctx, subscriber, feed, expires);
            }

            // Stats
            this.stats.decrement(ctx, 'subscriptions');

            return { seq, vt };
        });
    }

    async getFeedSubscribersCount(parent: Context, feed: Buffer) {
        return await inTxLeaky(parent, async (ctx) => {
            return await this.sub.getFeedSubscriptionsCount(ctx, feed);
        });
    }

    async getFeedDirectSubscribersCount(parent: Context, feed: Buffer) {
        return await inTxLeaky(parent, async (ctx) => {
            return await this.sub.getFeedDirectSubscriptionsCount(ctx, feed);
        });
    }

    async getFeedAsyncSubscribersCount(parent: Context, feed: Buffer) {
        return await inTxLeaky(parent, async (ctx) => {
            return await this.sub.getFeedAsyncSubscriptionsCount(ctx, feed);
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

    async post(parent: Context, args: { feed: Buffer, event: Buffer, collapseKey?: string | null | undefined }) {
        return await inTxLeaky(parent, async (ctx) => {

            // Allocate Seq
            let seq = await this.feedSeq.allocateSeq(ctx, args.feed);

            // Allocate index
            let vt = createVersionstampRef(ctx);

            // Write event to a stream
            if (args.collapseKey) {
                await this.feedEvents.writeCollapsedEvent(ctx, args.feed, args.event, seq, vt, args.collapseKey);
            } else {
                this.feedEvents.writeEvent(ctx, args.feed, args.event, seq, vt);
            }

            // Write latest reference
            await this.feedLatest.writeLatest(ctx, args.feed, seq, vt);

            // Update direct references
            let latest = await this.feedLatest.readFirstTransactionLatest(ctx, args.feed);
            await this.subDirect.setUpdatedReference(ctx, args.feed, seq, vt, latest);

            return { seq, vt };
        });
    }

    //
    // Changes
    //

    async getState(parent: Context, subscriber: Buffer) {
        return await inTxLeaky(parent, async (ctx) => {

            // NOTE: We are adding dump write to enforce transaction commit and 
            //       resolving of a version stamp
            this.subspace.add(ctx, Locations.subscriber.subscriptionVt(subscriber), ONE);

            // Resolve current seq
            let seq = await this.subSeq.getCurrentSeq(ctx, subscriber);

            // Resolve current state
            let vt = createVersionstampRef(ctx);

            return { seq, vt };
        });
    }

    async getChangedFeedsSeqNumbers(parent: Context, subscriber: Buffer, after: Buffer) {
        return await inTxLeaky(parent, async (ctx) => {
            let set = new BufferSet();
            let changed: { feed: Buffer, seq: number, vt: Buffer }[] = [];

            // Direct subscriptions
            let changedDirect = (await this.subDirect.getUpdatedFeeds(ctx, subscriber, after));
            for (let ch of changedDirect) {
                if (!set.has(ch.feed)) {
                    set.add(ch.feed);
                    changed.push({ feed: ch.feed, seq: ch.seq, vt: ch.vt });
                }
            }

            // Async subscriptions
            let asyncSubscriptions = await this.subAsync.getSubscriberFeeds(ctx, subscriber);
            let asyncHeads = await Promise.all(asyncSubscriptions.map(async (feed) => ({ latest: await this.feedLatest.readLatest(ctx, feed), feed })));
            for (let h of asyncHeads) {
                if (Buffer.compare(after, h.latest.vt.value) < 0) {
                    let state = await this.sub.getSubscriptionState(ctx, subscriber, h.feed);
                    if (!state || state.to !== null) {
                        throw Error('Broken state');
                    }
                    if (h.latest.seq <= state.from.seq) {
                        continue;
                    }
                    if (!set.has(h.feed)) {
                        set.add(h.feed);
                        changed.push({ feed: h.feed, seq: h.latest.seq, vt: h.latest.vt.value });
                    }
                }
            }

            return changed;
        });
    }

    async getChangedFeeds(parent: Context, subscriber: Buffer, after: Buffer) {
        return await inTxLeaky(parent, async (ctx) => {
            let set = new BufferSet();
            let events: { feed: Buffer, seq: number, vt: Buffer }[] = [];
            let changes: { feed: Buffer, seq: number, vt: Buffer, change: 'joined' | 'left' }[] = [];

            // Changed subscription states
            let changedSubscriptions = await this.subUpdated.getChanged(ctx, subscriber, after);

            // Add completed subscriptions
            for (let ch of changedSubscriptions) {
                let state = await this.sub.getSubscriptionState(ctx, subscriber, ch);
                if (!state) {
                    continue;
                }
                if (state.to !== null) {
                    changes.push({ feed: ch, seq: state.to.seq, vt: state.to.state, change: 'left' });
                } else {
                    changes.push({ feed: ch, seq: state.from.seq, vt: state.from.state, change: 'joined' });
                }
            }

            // Direct subscriptions
            let changedDirect = (await this.subDirect.getUpdatedFeeds(ctx, subscriber, after));
            for (let ch of changedDirect) {
                if (!set.has(ch.feed)) {
                    set.add(ch.feed);
                    events.push({ feed: ch.feed, seq: ch.seq, vt: ch.vt });
                }
            }

            // Async subscriptions
            let asyncSubscriptions = await this.subAsync.getSubscriberFeeds(ctx, subscriber);
            let asyncHeads = await Promise.all(asyncSubscriptions.map(async (feed) => ({ latest: await this.feedLatest.readLatest(ctx, feed), feed })));
            for (let h of asyncHeads) {
                if (Buffer.compare(after, h.latest.vt.value) < 0) {
                    let state = await this.sub.getSubscriptionState(ctx, subscriber, h.feed);
                    if (!state || state.to !== null) {
                        throw Error('Broken state');
                    }
                    if (h.latest.seq <= state.from.seq) {
                        continue;
                    }
                    if (!set.has(h.feed)) {
                        set.add(h.feed);
                        events.push({ feed: h.feed, seq: h.latest.seq, vt: h.latest.vt.value });
                    }
                }
            }

            return { events, changes };
        });
    }

    async getFeedDifference(parent: Context, subscriber: Buffer, feed: Buffer, after: Buffer | number, opts: { limits: { forwardOnly: number, generic: number } }) {
        return await inTxLeaky(parent, async (ctx) => {
            let state = await this.sub.getSubscriptionState(ctx, subscriber, feed);
            if (!state) {
                throw Error('Unable to find subscription state');
            }

            // Resolve actual after
            let afterAdjusted = after;
            let afterSeq: number;
            if (typeof after === 'number') {
                if (after < state.from.seq) {
                    afterAdjusted = state.from.state;
                    afterSeq = state.from.seq;
                } else {
                    afterSeq = after;
                }
            } else {
                if (Buffer.compare(after, state.from.state) < 0) {
                    afterAdjusted = state.from.state;
                    afterSeq = state.from.seq;
                } else {
                    let ss = await this.feedEvents.getPreviousSeq(ctx, feed, after);
                    if (ss < state.from.seq) {
                        afterSeq = state.from.seq;
                    } else {
                        afterSeq = ss;
                    }
                }
            }

            // Resolve actual before
            let before: Buffer | number | undefined = undefined;
            let active = true;
            if (state.to) {
                active = false;
                if (typeof after === 'number') {
                    if (state.to.seq <= after) {
                        return {
                            active,
                            forwardOnly: state.forwardOnly,
                            events: [],
                            hasMore: false,
                            afterSeq
                        };
                    } else {
                        before = state.to.state;
                    }
                } else {
                    if (Buffer.compare(state.to.state, after) <= 0) {
                        return {
                            active,
                            forwardOnly: state.forwardOnly,
                            events: [],
                            hasMore: false,
                            afterSeq
                        };
                    } else {
                        before = state.to.state;
                    }
                }
            }

            // Read events
            let res = await this.feedEvents.getEvents(ctx, feed, {
                mode: state.forwardOnly ? 'forward' : 'only-latest',
                limit: state.forwardOnly ? opts.limits.forwardOnly : opts.limits.generic,
                after: afterAdjusted,
                before
            });

            return {
                active,
                forwardOnly: state.forwardOnly,
                afterSeq,
                ...res
            };
        });
    }

    async getDifference(parent: Context, subscriber: Buffer, after: Buffer, opts: { limits: { forwardOnly: number, generic: number, global: number } }) {
        return await inTxLeaky(parent, async (ctx) => {
            let updates: { feed: Buffer, afterSeq: number, events: { seq: number, vt: Buffer, event: Buffer }[] }[] = [];
            let feeds: Buffer[] = [];

            // Load differences
            let hasMore = false;
            let diffs = await Promise.all(feeds.map(async (f) => ({ feed: f, diff: await this.getFeedDifference(ctx, subscriber, f, after, opts) })));
            let total = 0;
            for (let d of diffs) {

                // Enforce hasMore if strict feeds are changed
                if (d.diff.forwardOnly && d.diff.hasMore) {
                    hasMore = true;
                }

                // Convert updates
                updates.push({
                    feed: d.feed,
                    afterSeq: d.diff.afterSeq,
                    events: d.diff.events
                });

                // Calculate total
                total += d.diff.events.length;
            }

            let vt: Buffer = after;
            if (total > opts.limits.global) {
                // Cut updates
                let vts: Buffer[] = [];
                vts.sort((a, b) => Buffer.compare(a, b));
                for (let d of diffs) {
                    for (let e of d.diff.events) {
                        vts.push(e.vt);
                    }
                }
                let cut = vts[opts.limits.global - 1];
                cut = vt;

                // Updates
                for (let f of updates) {
                    f.events = f.events.filter((v) => Buffer.compare(v.vt, cut) <= 0);
                }
                updates = updates.filter((v) => v.events.length > 0);
            } else {
                // Update diff
                for (let d of diffs) {
                    for (let e of d.diff.events) {
                        if (Buffer.compare(vt, e.vt) < 0) {
                            vt = e.vt;
                        }
                    }
                }
            }

            // Resolve current seq
            let seq = await this.subSeq.getCurrentSeq(ctx, subscriber);

            return { updates, hasMore, seq, vt };
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
            let old = await this.subSeq.getOnlineExpires(ctx, subscriber);
            if (old !== null && old > clamped) {
                return;
            }
            await this.subSeq.refreshOnline(ctx, subscriber, clamped);
            await this.subAsync.setSubscriberOnline(ctx, subscriber, clamped, old);
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