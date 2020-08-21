import { Context } from '@openland/context';
import { inTx, Subspace, encoders, TransactionCache, getTransaction, assertNoTransaction, inTxLeaky } from '@openland/foundationdb';
import { randomId } from 'openland-utils/randomId';
import { EventBus } from 'openland-module-pubsub/EventBus';

const feedIndexCache = new TransactionCache<number>('feed-index-cache');

//
// Registry is a simple collection of existing ids and there are nothing 
// should be optimized since they are already evenly distributed.
//

const REGISTRY_FEED = 0;
const REGISTRY_SUBSCRIBERS = 1;

//
// Feed Subspaces.
// We are doing small trick for faster feed performance: we put settings right after stream of events.
// For latest records + settings they are could be almost always on the same machine and may be even in the same 
// disk page.
// This will lead to faster operations of a fetching latest + all subscribers (for non jumbo feeds).
//

const FEED_STREAM = 0;
const FEED_LATEST = 1;
const FEED_REPEAT = 3;
const FEED_SETTINGS = 2;
const FEED_SETTINGS_SEQ = 0;
const FEED_SETTINGS_SUBSCRIBERS_COUNT = 1;
const FEED_SETTINGS_SUBSCRIBERS = 2;
const FEED_SETTINGS_JUMBO = 3;

//
// Subscribers subspace.
//
//
// "VT" means versionstamp and used as a dumb atomic field for getState operation that depends
// on transaction being commited. We are not using single field for all users since it could
// create very hot key and could overflow storage nodes where it is stored.
//
// Subscriptions is a simple list of active subscriptions optimized for reading them all at the same time.
//

const SUBSCRIBERS_VT = 1;
const SUBSCRIBERS_VERSION = 3;
const SUBSCRIBERS_SUBSCRIPTIONS = 2;
const SUBSCRIBERS_SUBSCRIPTIONS_JOIN = 0;
const SUBSCRIBERS_SUBSCRIPTIONS_LATEST = 1;
const SUBSCRIBERS_SUBSCRIPTIONS_JUMBO = 2;
const SUBSCRIBERS_SUBSCRIPTIONS_STRICT = 3;

const ZERO = Buffer.alloc(0);
// const ONE = Buffer.alloc(1);

const PLUS_ONE = encoders.int32LE.pack(1);
const MINUS_ONE = encoders.int32LE.pack(-1);

export type ID = Buffer;

function checkId(src: Buffer) {
    if (!Buffer.isBuffer(src)) {
        throw Error('ID is not a buffer');
    }
    if (src.length !== 16) {
        throw Error('ID has invalid length');
    }
}

function checkState(src: Buffer) {
    if (!Buffer.isBuffer(src)) {
        throw Error('ID is not a buffer');
    }
    if (src.length !== 12) {
        throw Error('ID has invalid length');
    }
}

function serialize(src: Buffer) {
    return src.toString('hex');
}

export type RawEvent = { id: Buffer, seq: number, type: 'event' | 'start', body: Buffer | null };

export class EventsStorage {

    private readonly testing: boolean;
    private readonly feedsDirectory: Subspace;
    private readonly subscribersDirectory: Subspace;
    private readonly registryDirectory: Subspace;

    constructor(directory: Subspace, testing: boolean = false) {
        this.testing = testing;
        this.feedsDirectory = directory.subspace(encoders.tuple.pack([0]));
        this.subscribersDirectory = directory.subspace(encoders.tuple.pack([1]));
        this.registryDirectory = directory.subspace(encoders.tuple.pack([2]));
    }

    //
    // Subscription
    //

    async createSubscriber(parent: Context) {
        return await inTxLeaky(parent, async (ctx: Context) => {
            while (true) {
                // Create unique random id for a subscriber for even data distribution
                let id = randomId();
                let key = encoders.tuple.pack([REGISTRY_SUBSCRIBERS, id]);

                // Just in case - check that id is not used already
                if (await this.registryDirectory.snapshotExists(ctx, key)) {
                    continue;
                }

                // Save registered id
                this.registryDirectory.addReadConflictKey(ctx, key);
                this.registryDirectory.set(ctx, key, ZERO);

                return id;
            }
        });
    }

    async subscribe(parent: Context, subscriber: ID, feed: ID, opts?: { strict?: boolean }) {
        checkId(subscriber);
        checkId(feed);

        // Resolve strict parameter
        let strict = opts && opts.strict ? opts.strict : false;

        await inTxLeaky(parent, async (ctx: Context) => {

            // Read jumbo flag of a feed
            let isJumbo = await this.feedsDirectory.exists(ctx, encoders.tuple.pack([feed, FEED_SETTINGS, FEED_SETTINGS_JUMBO]));

            // Make jumbo frame as read conflict
            this.feedsDirectory.addReadConflictKey(ctx, encoders.tuple.pack([feed, FEED_SETTINGS, FEED_SETTINGS_JUMBO]));

            // Make latest time as read conflict
            // NOTE: We are marking latest as conflict to generate conflict if there will be subscribe and posting at the same time
            //       since subscriber list will be changed and delivery could be broken.
            //       We are doing read conflict key on subscribe side instead of posting side to make posting as non-conflict as possible.
            this.feedsDirectory.addReadConflictKey(ctx, encoders.tuple.pack([feed, FEED_LATEST]));

            //
            // Add feed to subscriber
            // 

            // Check if subscription exists
            let subscriberKey = encoders.tuple.pack([subscriber, SUBSCRIBERS_SUBSCRIPTIONS, feed, SUBSCRIBERS_SUBSCRIPTIONS_JOIN]);
            if (await this.subscribersDirectory.exists(ctx, subscriberKey)) {
                throw Error('Already subscribed');
            }

            // Save a join time
            let index = this.resolveIndex(ctx); // Resolving event index to save point in time of subscription start
            this.subscribersDirectory.setVersionstampedValue(ctx, subscriberKey, ZERO, index);

            // Save jumbo flag
            if (isJumbo) {
                this.subscribersDirectory.set(ctx, encoders.tuple.pack([subscriber, SUBSCRIBERS_SUBSCRIPTIONS, feed, SUBSCRIBERS_SUBSCRIPTIONS_JUMBO]), ZERO);
            }

            // Save strict flag
            if (strict) {
                this.subscribersDirectory.set(ctx, encoders.tuple.pack([subscriber, SUBSCRIBERS_SUBSCRIPTIONS, feed, SUBSCRIBERS_SUBSCRIPTIONS_STRICT]), ZERO);
            }

            //
            // Add subscriber to feed
            // 

            // Increase subscribers count
            this.feedsDirectory.add(ctx, encoders.tuple.pack([feed, FEED_SETTINGS, FEED_SETTINGS_SUBSCRIBERS_COUNT]), PLUS_ONE);

            // Write subscriber to a feed if needed
            if (!isJumbo) {
                this.feedsDirectory.add(ctx, encoders.tuple.pack([feed, FEED_SETTINGS, FEED_SETTINGS_SUBSCRIBERS, subscriber]), ZERO);
            }

            //
            // Increase subscriber version
            //

            this.subscribersDirectory.add(ctx, encoders.tuple.pack([subscriber, SUBSCRIBERS_VERSION]), PLUS_ONE);
        });
    }

    async unsubscribe(parent: Context, subscriber: ID, feed: ID) {
        checkId(subscriber);
        checkId(feed);

        await inTxLeaky(parent, async (ctx: Context) => {

            // Read jumbo flag of a feed
            let isJumbo = await this.feedsDirectory.exists(ctx, encoders.tuple.pack([feed, FEED_SETTINGS, FEED_SETTINGS_JUMBO]));

            // Make jumbo frame as read conflict
            this.feedsDirectory.addReadConflictKey(ctx, encoders.tuple.pack([feed, FEED_SETTINGS, FEED_SETTINGS_JUMBO]));

            //
            // Remove feed from subscriber
            //

            let subscriberKey = encoders.tuple.pack([subscriber, SUBSCRIBERS_SUBSCRIPTIONS, feed, SUBSCRIBERS_SUBSCRIPTIONS_JOIN]);
            if (!(await this.subscribersDirectory.exists(ctx, subscriberKey))) {
                throw Error('Already unsubscribed');
            }
            this.subscribersDirectory.clear(ctx, subscriberKey);
            if (!isJumbo) {
                this.subscribersDirectory.clear(ctx, encoders.tuple.pack([subscriber, SUBSCRIBERS_SUBSCRIPTIONS, feed, SUBSCRIBERS_SUBSCRIPTIONS_LATEST]));
            } else {
                this.subscribersDirectory.clear(ctx, encoders.tuple.pack([subscriber, SUBSCRIBERS_SUBSCRIPTIONS, feed, SUBSCRIBERS_SUBSCRIPTIONS_JUMBO]));
            }

            //
            // Remove from feed
            //

            // Decrease subscribers count
            this.feedsDirectory.add(ctx, encoders.tuple.pack([feed, FEED_SETTINGS, FEED_SETTINGS_SUBSCRIBERS_COUNT]), MINUS_ONE);

            // Remove from feed if not jumbo feed
            if (!isJumbo) {
                this.feedsDirectory.clear(ctx, encoders.tuple.pack([feed, FEED_SETTINGS, FEED_SETTINGS_SUBSCRIBERS, subscriber]));
            }

            //
            // Increase subscriber version
            //

            this.subscribersDirectory.add(ctx, encoders.tuple.pack([subscriber, SUBSCRIBERS_VERSION]), PLUS_ONE);
        });
    }

    //
    // Subscription watching
    //

    async getSubscriberVersion(parent: Context, subscriber: ID) {
        checkId(subscriber);
        return await inTxLeaky(parent, async (ctx: Context) => {
            let ex = await this.subscribersDirectory.get(ctx, encoders.tuple.pack([subscriber, SUBSCRIBERS_VERSION]));
            if (ex) {
                return encoders.int32LE.unpack(ex);
            } else {
                return 0;
            }
        });
    }

    async watchSubscriberVersion(parent: Context, subscriber: ID) {
        checkId(subscriber);
        return await inTxLeaky(parent, async (ctx: Context) => {
            return this.subscribersDirectory.watch(ctx, encoders.tuple.pack([subscriber, SUBSCRIBERS_VERSION]));
        });
    }

    async getSubscriberSubscriptions(parent: Context, subscriber: ID) {
        checkId(subscriber);

        return await inTxLeaky(parent, async (ctx: Context) => {
            let allSubscriptions = await this.subscribersDirectory.range(ctx, encoders.tuple.pack([subscriber, SUBSCRIBERS_SUBSCRIPTIONS]));

            //
            // Trying to be optimized here since this method could be called very often
            //

            let res: { id: Buffer, joined: Buffer, latest: Buffer | null, jumbo: boolean, strict: boolean }[] = [];
            let currentKey: Buffer | null = null;
            let latest: Buffer | null = null;
            let joined: Buffer | null = null;
            let jumbo = false;
            let strict = false;
            function flush() {
                if (currentKey && joined) {
                    res.push({ id: currentKey, joined, latest, jumbo, strict });
                }
                currentKey = null;
                joined = null;
                latest = null;
                jumbo = false;
            }
            for (let a of allSubscriptions) {
                let tuple = encoders.tuple.unpack(a.key);
                let feedId = tuple[2] as Buffer;
                if (currentKey && Buffer.compare(currentKey, feedId) !== 0) {
                    flush();
                }
                currentKey = feedId;
                if (tuple[3] === SUBSCRIBERS_SUBSCRIPTIONS_JOIN) {
                    joined = a.value;
                }
                if (tuple[3] === SUBSCRIBERS_SUBSCRIPTIONS_LATEST) {
                    latest = a.value;
                }
                if (tuple[3] === SUBSCRIBERS_SUBSCRIPTIONS_JUMBO) {
                    jumbo = true;
                }
                if (tuple[3] === SUBSCRIBERS_SUBSCRIPTIONS_STRICT) {
                    strict = true;
                }
            }
            flush();

            return res;
        });
    }

    //
    // Updates
    //

    async getState(parent: Context, subscriber: ID) {
        checkId(subscriber);
        assertNoTransaction(parent);

        let state = await inTx(parent, async (ctx) => {

            // Resolving event index
            let index = this.resolveIndex(ctx);

            // Versionstamp
            let versionStamp = getTransaction(ctx).rawTransaction(this.subscribersDirectory.db).getVersionstamp();

            // Perform dump write to being able resolve versionstamp
            this.subscribersDirectory.add(ctx, encoders.tuple.pack([subscriber, SUBSCRIBERS_VT]), PLUS_ONE);

            return {
                promise: (async () => {
                    return Buffer.concat([await versionStamp.promise, index]);
                })()
            };
        });
        return await state.promise;
    }

    async getFeedUpdates(parent: Context, feed: ID, opts: { mode: 'forward' | 'only-latest', limit: number, after: Buffer }) {
        return await inTxLeaky(parent, async (ctx) => {
            let cursor = Buffer.concat([encoders.tuple.pack([feed, FEED_STREAM]), opts.after]);
            let read = opts.mode === 'forward'
                ? await this.feedsDirectory.range(ctx, encoders.tuple.pack([feed, FEED_STREAM]), { after: cursor, reverse: false, limit: opts.limit + 1 })
                : await this.feedsDirectory.range(ctx, encoders.tuple.pack([feed, FEED_STREAM]), { before: cursor, reverse: true, limit: opts.limit + 1 });
            let updates: RawEvent[] = [];
            for (let i = 0; i < Math.min(opts.limit, read.length); i++) {
                let r = read[i];
                let id = r.key.slice(r.key.length - 12);
                let value = encoders.tuple.unpack(r.value);
                let seq = value[0] as number;
                let type = value[1] as number;
                let body = value[2] as Buffer;
                if (opts.mode === 'only-latest') {
                    if (type === 1 /* Type: Event */) {
                        updates.unshift({ id, seq, body, type: 'event' });
                    } else {
                        updates.unshift({ id, seq, body, type: 'start' });
                    }
                } else {
                    if (type === 1 /* Type: Event */) {
                        updates.push({ id, seq, body, type: 'event' });
                    } else {
                        updates.push({ id, seq, body, type: 'start' });
                    }
                }
            }
            return { updates, hasMore: read.length > opts.limit };
        });
    }

    async getDifference(parent: Context, subscriber: ID, args: { state: Buffer, batchSize: number, limit: number }): Promise<{ events: RawEvent[], partial: ID[], completed: boolean }> {
        checkId(subscriber);
        checkState(args.state);

        return await inTxLeaky(parent, async (ctx) => {

            // Fetch subscriptions
            let subscriptions = await this.getSubscriberSubscriptions(ctx, subscriber);

            // Resolve required requests
            let requests: { id: Buffer, after: Buffer, strict: boolean }[] = [];
            let pending: Promise<void>[] = [];
            for (let s of subscriptions) {
                let feed = s.id;

                // Difference state = max (join, state);
                let after = args.state;
                if (Buffer.compare(args.state, s.joined) < 0) {
                    after = s.joined;
                }

                // Fast path to ignore not updated feeds
                if (!s.jumbo) {
                    if (s.latest) {
                        // If latest event is still before difference start: ignore
                        if (Buffer.compare(s.latest, after) <= 0) {
                            continue;
                        }
                    } else {
                        // No updates was written after subscribing
                        continue;
                    }

                    // Put request
                    requests.push({ id: s.id, after, strict: s.strict });
                } else {
                    pending.push((async () => {
                        // Resolve latest
                        let latest = await this.feedsDirectory.get(ctx, encoders.tuple.pack([feed, FEED_LATEST]));
                        if (!latest) {
                            return;
                        }
                        if (Buffer.compare(latest, after) <= 0) {
                            return;
                        }

                        // Add new request
                        requests.push({ id: s.id, after, strict: s.strict });
                    })());
                }
            }

            // Await read of top events
            await Promise.all(pending);

            // Fast code path if there are no updates
            if (requests.length === 0) {
                return { events: [], partial: [], completed: true };
            }

            // Fetch all feeds
            let feeds = await Promise.all(requests.map(
                async (request) => {
                    let read = await this.getFeedUpdates(ctx, request.id, { after: request.after, limit: args.batchSize, mode: request.strict ? 'forward' : 'only-latest' });
                    return { updates: read.updates, hasMore: read.hasMore, id: request.id, strict: request.strict };
                }
            ));

            //
            // Feed merging
            //

            let events: RawEvent[] = [];
            let partial: Buffer[] = [];
            let completed = true;

            // Merge all feeds
            for (let feed of feeds) {

                // Mark feed as partial if needed
                if (feed.hasMore) {
                    partial.push(feed.id);
                    if (feed.strict) {
                        completed = false;
                    }
                }

                // Simply merge all events
                for (let event of feed.updates) {
                    events.unshift(event);
                }
            }

            // Sort events
            events.sort((a, b) => a.id.compare(b.id));

            // Limit number of events. It seems that this is 
            // a simple and correct way to do so - simply cut by date.
            if (events.length > args.limit) {
                events = events.slice(0, args.limit);
                completed = false;
            }

            return { events, partial, completed };
        });
    }

    //
    // Feed
    //

    async createFeed(parent: Context) {
        return await inTxLeaky(parent, async (ctx: Context) => {
            while (true) {
                // Create unique random id for a subscriber for even data distribution
                let id = randomId();
                let key = encoders.tuple.pack([REGISTRY_FEED, id]);

                // Just in case - check that id is not used already
                if (await this.registryDirectory.snapshotExists(ctx, key)) {
                    continue;
                }

                // Save registered id
                this.registryDirectory.addReadConflictKey(ctx, key);
                this.registryDirectory.set(ctx, key, ZERO);

                // Write create event
                let index = this.resolveIndex(ctx);
                let seq = 1;
                let body = encoders.tuple.pack([seq, 0 /* Body Type: Start */, ZERO]);
                this.feedsDirectory.setVersionstampedKey(ctx, encoders.tuple.pack([id, FEED_STREAM]), body, index);

                // Write initial seq
                this.feedsDirectory.set(ctx, encoders.tuple.pack([id, FEED_SETTINGS, FEED_SETTINGS_SEQ]), encoders.int32BE.pack(seq));

                // Write latest event time
                this.feedsDirectory.setVersionstampedValue(ctx, encoders.tuple.pack([id, FEED_LATEST]), ZERO, index);

                return { id, seq, index };
            }
        });
    }

    async upgradeFeed(parent: Context, id: ID) {
        checkId(id);

        return await inTxLeaky(parent, async (ctx) => {
            // Read feed settings
            let settings = await this.readFeedSettingsSnapshot(ctx, id);

            // Ignore already upgraded feed
            if (settings.jumbo) {
                return;
            }

            // Update jumbo key
            let jumboKey = encoders.tuple.pack([id, FEED_SETTINGS, FEED_SETTINGS_JUMBO]);
            this.feedsDirectory.addReadConflictKey(ctx, jumboKey);
            this.feedsDirectory.set(ctx, jumboKey, ZERO);

            // Mark subscribers count as read conflict
            this.feedsDirectory.addReadConflictKey(ctx, encoders.tuple.pack([id, FEED_SETTINGS, FEED_SETTINGS_SUBSCRIBERS_COUNT]));

            // Upgrade subscribers
            for (let subscriber of settings.subscribers) {
                this.subscribersDirectory.set(ctx, encoders.tuple.pack([subscriber, SUBSCRIBERS_SUBSCRIPTIONS, id, SUBSCRIBERS_SUBSCRIPTIONS_JUMBO]), ZERO);
                this.subscribersDirectory.clear(ctx, encoders.tuple.pack([subscriber, SUBSCRIBERS_SUBSCRIPTIONS, id, SUBSCRIBERS_SUBSCRIPTIONS_LATEST]));
                this.subscribersDirectory.add(ctx, encoders.tuple.pack([subscriber, SUBSCRIBERS_VERSION]), PLUS_ONE);
            }

            // Clear subscribers
            this.feedsDirectory.clearPrefixed(ctx, encoders.tuple.pack([id, FEED_SETTINGS, FEED_SETTINGS_SUBSCRIBERS]));
        });
    }

    //
    // Posting
    //

    resolvePostId(parent: Context, index: Buffer) {
        let vt = getTransaction(parent).rawTransaction(this.feedsDirectory.db).getVersionstamp();
        return {
            promise: (async () => {
                return Buffer.concat([await vt.promise, index]);
            })()
        };
    }

    async post(parent: Context, feed: Buffer, event: Buffer, opts?: { repeatKey?: Buffer }) {
        checkId(feed);

        // Resolve repeat key
        let repeatKey: Buffer | undefined = opts && opts.repeatKey ? opts.repeatKey : undefined;

        //
        // Note about read conflicts
        //
        // We are optimizing operation as conflict free as possible and only real 
        // read conflict that could not be avoided is seq and jumbo states.
        // Seq is monotonically increasing and jumbo feed changes its behaviour dramatically
        // but could be changed only once and not that important.
        //

        return await inTxLeaky(parent, async (ctx) => {

            // Read feed settings
            let settings = await this.readFeedSettingsSnapshot(ctx, feed);

            // Resolve counter
            let seq = settings.counter + 1;
            let seqKey = encoders.tuple.pack([feed, FEED_SETTINGS, FEED_SETTINGS_SEQ]);
            this.feedsDirectory.addReadConflictKey(ctx, seqKey);
            this.feedsDirectory.set(ctx, seqKey, encoders.int32BE.pack(seq));

            // Put event to feed
            let index = this.resolveIndex(ctx);
            let body = encoders.tuple.pack([seq, 1 /* Body Type: Event */, event]);
            this.feedsDirectory.setVersionstampedKey(ctx, encoders.tuple.pack([feed, FEED_STREAM]), body, index);

            // Put latest event versionstamp
            this.feedsDirectory.setVersionstampedValue(ctx, encoders.tuple.pack([feed, FEED_LATEST]), ZERO, index);

            // Handle repeat key
            if (repeatKey) {
                let repeatRef = encoders.tuple.pack([feed, FEED_REPEAT, repeatKey]);

                // Clear previous event if exists
                let prevPost = await this.feedsDirectory.get(ctx, repeatRef);
                if (prevPost) {
                    this.feedsDirectory.clear(ctx, Buffer.concat([encoders.tuple.pack([feed, FEED_STREAM]), prevPost]));
                }

                // Save repeat key reference to current event
                this.feedsDirectory.setVersionstampedValue(ctx, repeatRef, ZERO, index);
            }

            // Delivery of non jumbo feeds
            this.feedsDirectory.addReadConflictKey(ctx, encoders.tuple.pack([feed, FEED_SETTINGS, FEED_SETTINGS_JUMBO]));
            let subscribers: (Buffer[]) | null = null;
            if (!settings.jumbo) {
                subscribers = settings.subscribers;
                for (let s of settings.subscribers) {
                    let subscriberKey = encoders.tuple.pack([s, SUBSCRIBERS_SUBSCRIPTIONS, feed, SUBSCRIBERS_SUBSCRIPTIONS_LATEST]);
                    this.subscribersDirectory.setVersionstampedValue(
                        ctx,
                        subscriberKey,
                        ZERO,
                        index
                    );
                }
            }

            // Notify
            if (!this.testing) {
                let resolveId = this.resolvePostId(ctx, index);
                getTransaction(ctx).afterCommit(async () => {
                    let postIdRaw = await resolveId.promise;
                    let feedId = serialize(feed);
                    let postId = serialize(postIdRaw);
                    EventBus.publish(`events.feed.${feedId}`, { seq, feedId, postId });
                    if (!settings.jumbo) {
                        for (let s of settings.subscribers) {
                            let subscriber = serialize(s);
                            EventBus.publish(`events.subscriber.${subscriber}`, { seq, feedId, postId });
                        }
                    }
                });
            }

            return {
                seq,
                index,
                subscribers
            };
        });
    }

    //
    // Utility
    //

    private async readFeedSettingsSnapshot(ctx: Context, feed: ID) {
        let settings = await this.feedsDirectory.snapshotRange(ctx, encoders.tuple.pack([feed, FEED_SETTINGS]));
        let jumbo = false;
        let count = 0;
        let seq = 0;
        let subscribers: ID[] = [];
        for (let s of settings) {
            let decoded = encoders.tuple.unpack(s.key);
            if (decoded[2] === FEED_SETTINGS_SUBSCRIBERS_COUNT) {
                count = encoders.int32LE.unpack(s.value);
            } else if (decoded[2] === FEED_SETTINGS_JUMBO) {
                jumbo = true;
            } else if (decoded[2] === FEED_SETTINGS_SEQ) {
                seq = encoders.int32BE.unpack(s.value);
            } else if (decoded[2] === FEED_SETTINGS_SUBSCRIBERS) {
                let subscriberId = decoded[decoded.length - 1] as Buffer;
                subscribers.push(subscriberId);
            }
        }
        return {
            jumbo,
            subscribers,
            subscribersCount: count,
            counter: seq,
        };
    }

    private resolveIndex(ctx: Context) {
        let index = (feedIndexCache.get(ctx, 'key') || 0) + 1;
        feedIndexCache.set(ctx, 'key', index);
        return encoders.int16BE.pack(index);
    }
}