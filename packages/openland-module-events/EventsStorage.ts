import uuid from 'uuid/v4';
import { createNamedContext, Context } from '@openland/context';
import { inTx, Subspace, Database, encoders, TransactionCache, getTransaction, assertNoTransaction } from '@openland/foundationdb';

const feedIndexCache = new TransactionCache<number>('feed-index-cache');

const SUBSPACE_SETTINGS = 0;
const SETTINGS_COUNTER = 0;
const SETTINGS_SUBSCRIBERS_COUNT = 1;
const SETTINGS_SUBSCRIBERS = 2;
const SETTINGS_JUMBO = 3;

const SUBSPACE_FEED_TIME = 1;
const SUBSPACE_FEED_SEQ = 2;
const SUBSPACE_FEED_ID = 3;

const SUBSPACE_VT = 0;
const SUBSPACE_SUBSCRIPTION = 1;

const ZERO = Buffer.alloc(0);

const PLUS_ONE = encoders.int32LE.pack(1);
const MINUS_ONE = encoders.int32LE.pack(-1);

export type EID = { id: number, kind: number };

export class EventsStorage {

    static async open(db: Database) {
        let resolved = await inTx(createNamedContext('entity'), async (ctx) => {
            let subscribersDirectory = (await db.directories.createOrOpen(ctx,
                ['com.openland.events', 'subscribers']
            ));
            let feedsDirectory = (await db.directories.createOrOpen(ctx,
                ['com.openland.events', 'feeds']
            ));
            return { feedsDirectory, subscribersDirectory };
        });
        return new EventsStorage(resolved.feedsDirectory, resolved.subscribersDirectory);
    }

    readonly feedsDirectory: Subspace;
    readonly subscribersDirectory: Subspace;

    private constructor(feedsDirectory: Subspace, subscribersDirectory: Subspace) {
        this.feedsDirectory = feedsDirectory;
        this.subscribersDirectory = subscribersDirectory;
    }

    //
    // Subscription
    //

    async subscribe(ctx: Context, subscriber: EID, feed: EID) {

        // Resolving event to save point in time of subscription
        let index = await this.resolveIndex(ctx);

        // Add feed to subscriber
        let subscriberKey = encoders.tuple.pack([subscriber.kind, subscriber.id, SUBSPACE_SUBSCRIPTION, feed.kind, feed.id]);
        let ex = await this.subscribersDirectory.get(ctx, subscriberKey);
        if (ex !== null) {
            throw Error('Already subscribed');
        }
        this.subscribersDirectory.setVersionstampedValue(ctx, subscriberKey, ZERO, index);

        // Add subscriber to feed
        let settings = await this.readFeedSettings(ctx, feed);

        // Only jumbo flag is real dependency
        // Number of subscribers is not really dependent value and we can ignore conflict for minor inconstency
        // Subscriber counter is also incremented atomically instead of get and set.
        this.feedsDirectory.addReadConflictKey(ctx, encoders.tuple.pack([feed.kind, feed.id, SUBSPACE_SETTINGS, SETTINGS_JUMBO]));

        // Upgrade feed if needed
        if (!settings.jumbo && settings.subscribersCount >= 50) {
            settings.jumbo = true;

            // Delete subscribers list
            this.feedsDirectory.clear(ctx, encoders.tuple.pack([feed.kind, feed.id, SUBSPACE_SETTINGS, SETTINGS_SUBSCRIBERS]));

            // Mark as jumbo feed
            this.feedsDirectory.set(ctx, encoders.tuple.pack([feed.kind, feed.id, SUBSPACE_SETTINGS, SETTINGS_JUMBO]), ZERO);
        }

        // Write subscribers
        if (!settings.jumbo) {
            this.feedsDirectory.set(ctx, encoders.tuple.pack([feed.kind, feed.id, SUBSPACE_SETTINGS, SETTINGS_SUBSCRIBERS, subscriber.kind, subscriber.id]), ZERO);
        }

        // Increase subscribers count
        this.feedsDirectory.add(ctx, encoders.tuple.pack([feed.kind, feed.id, SUBSPACE_SETTINGS, SETTINGS_SUBSCRIBERS_COUNT]), PLUS_ONE);
    }

    async unsubscribe(ctx: Context, subscriber: EID, feed: EID) {
        let subscriberKey = encoders.tuple.pack([subscriber.kind, subscriber.id, SUBSPACE_SUBSCRIPTION, feed.kind, feed.id]);
        let ex = await this.subscribersDirectory.get(ctx, subscriberKey);
        if (ex === null) {
            throw Error('Already unsubscribed');
        }
        this.subscribersDirectory.clear(ctx, subscriberKey);

        // Add subscriber to feed
        let settings = await this.readFeedSettings(ctx, feed);

        // Mark jumbo flag as read conflict key
        this.feedsDirectory.addReadConflictKey(ctx, encoders.tuple.pack([feed.kind, feed.id, SUBSPACE_SETTINGS, SETTINGS_JUMBO]));

        // Clear subscribers
        if (!settings.jumbo) {
            this.feedsDirectory.clear(ctx, encoders.tuple.pack([feed.kind, feed.id, SUBSPACE_SETTINGS, SETTINGS_SUBSCRIBERS, subscriber.kind, subscriber.id]));
        }

        // Decrese subscribers count
        this.feedsDirectory.add(ctx, encoders.tuple.pack([feed.kind, feed.id, SUBSPACE_SETTINGS, SETTINGS_SUBSCRIBERS_COUNT]), MINUS_ONE);
    }

    async getState(parent: Context, subscriber: EID) {
        assertNoTransaction(parent);

        let state = await inTx(parent, async (ctx) => {

            // Resolving event index
            let index = await this.resolveIndex(ctx);

            // Versionstamp
            let versionStamp = getTransaction(ctx).rawTransaction(this.feedsDirectory.db).getVersionstamp();

            // Perform dump write to being able resolve versionstamp
            this.subscribersDirectory.add(ctx, encoders.tuple.pack([subscriber.kind, subscriber.id, SUBSPACE_VT]), PLUS_ONE);

            return {
                promise: (async () => {
                    return Buffer.concat([await versionStamp.promise, index]);
                })()
            };
        });
        return await state.promise;
    }

    // async getDifference(parent: Context, feed: EID, state: Buffer) {
    //     await inTx(parent, async (ctx) => {
    //         let updates = await this.fetchAfter(ctx, feed, state, 11);
    //     });
    // }

    //
    // Feed
    //

    async post(ctx: Context, feed: EID) {

        // Resolve counter
        let counterKey = encoders.tuple.pack([feed.kind, feed.id, SUBSPACE_SETTINGS, SETTINGS_COUNTER]);
        let counterRaw = await this.feedsDirectory.get(ctx, counterKey);
        let counter = 1;
        if (counterRaw) {
            counter = encoders.int32BE.unpack(counterRaw) + 1;
        }
        this.feedsDirectory.set(ctx, counterKey, encoders.int32BE.pack(counter));

        // Resolve settings
        let jumboKey = encoders.tuple.pack([feed.kind, feed.id, SUBSPACE_SETTINGS, SETTINGS_JUMBO]);
        let jumboRaw = await this.feedsDirectory.get(ctx, jumboKey);
        let isJumbo = jumboRaw !== null;

        // Generate Unique ID
        let id = Buffer.alloc(16);
        uuid(undefined, id);

        // Index of work item in the transaction

        // Put event to feed
        let index = await this.resolveIndex(ctx);

        // Sorted by time
        this.feedsDirectory.setVersionstampedKey(ctx, encoders.tuple.pack([feed.kind, feed.id, SUBSPACE_FEED_TIME]), encoders.tuple.pack([id, counter]), index);
        // Sorted by seq
        this.feedsDirectory.setVersionstampedValue(ctx, encoders.tuple.pack([feed.kind, feed.id, SUBSPACE_FEED_SEQ, counter]), id, index);
        // Id to seq + time
        this.feedsDirectory.setVersionstampedValue(ctx, encoders.tuple.pack([feed.kind, feed.id, SUBSPACE_FEED_ID, id]), encoders.tuple.pack([counter]), index);

        // Do delivery
        if (!isJumbo) {
            let subscribersPrefix = encoders.tuple.pack([feed.kind, feed.id, SUBSPACE_SETTINGS, SETTINGS_SUBSCRIBERS]);
            let subscribersRaw = await this.feedsDirectory.range(ctx, subscribersPrefix);
            let subscribers: { kindId: number, subscriberId: number }[] = [];
            for (let r of subscribersRaw) {
                let decoded = encoders.tuple.unpack(r.key);
                let subscriberKindId = decoded[decoded.length - 2] as number;
                let subscriberId = decoded[decoded.length - 1] as number;
                subscribers.push({ kindId: subscriberKindId, subscriberId });
            }

            // TODO: Perform delivery
        }

        return id;
    }

    async get(ctx: Context, feed: EID, id: Buffer) {
        let ex = await this.feedsDirectory.get(ctx, encoders.tuple.pack([feed.kind, feed.id, SUBSPACE_FEED_ID, id]));
        if (!ex) {
            return null;
        }
        let counter = encoders.tuple.unpack(ex.slice(0, ex.length - 12))[0] as number;
        let date = ex.slice(ex.length - 12);
        return {
            id,
            date,
            seq: counter
        };
    }

    async fetchAfter(ctx: Context, feed: EID, after: Buffer, limit: number) {
        if (after.length !== 12) {
            throw Error('Offset is invalid');
        }

        let read = await this.feedsDirectory.range(ctx, encoders.tuple.pack([feed.kind, feed.id, SUBSPACE_FEED_TIME]), { after, limit });
        let res: { id: Buffer, seq: number, date: Buffer }[] = [];
        for (let r of read) {
            res.push(this.convertFromTimeFeed(r.key, r.value));
        }
        return res;
    }

    async fetchLast(ctx: Context, feed: EID, limit: number) {
        let read = await this.feedsDirectory.range(ctx, encoders.tuple.pack([feed.kind, feed.id, SUBSPACE_FEED_TIME]), { reverse: true, limit });
        let res: { id: Buffer, seq: number, date: Buffer }[] = [];
        for (let r of read) {
            res.unshift(this.convertFromTimeFeed(r.key, r.value));
        }
        return res;
    }

    private convertFromTimeFeed = (key: Buffer, value: Buffer) => {
        let date = key.slice(key.length - 12);
        let valueTuple = encoders.tuple.unpack(value);
        let id = valueTuple[0] as Buffer;
        let seq = valueTuple[1] as number;
        return { id, seq, date };
    }

    private async readFeedSettings(ctx: Context, feed: EID) {
        let settings = await this.feedsDirectory.snapshotRange(ctx, encoders.tuple.pack([feed.kind, feed.id, SUBSPACE_SETTINGS]));
        let jumbo = false;
        let count = 0;
        let seq = 0;
        let subscribers: EID[] = [];
        for (let s of settings) {
            let decoded = encoders.tuple.unpack(s.key);
            if (decoded[3] === SETTINGS_SUBSCRIBERS_COUNT) {
                count = encoders.int32LE.unpack(s.value);
            } else if (decoded[3] === SETTINGS_JUMBO) {
                jumbo = true;
            } else if (decoded[3] === SETTINGS_COUNTER) {
                seq = encoders.int32BE.unpack(s.value);
            } else if (decoded[3] === SETTINGS_SUBSCRIBERS) {
                let subscriberKindId = decoded[decoded.length - 2] as number;
                let subscriberId = decoded[decoded.length - 1] as number;
                subscribers.push({ id: subscriberId, kind: subscriberKindId });
            }
        }
        return {
            jumbo,
            subscribers,
            subscribersCount: count,
            counter: seq,
        };
    }

    private async resolveIndex(ctx: Context) {
        let index = (feedIndexCache.get(ctx, 'key') || 0) + 1;
        feedIndexCache.set(ctx, 'key', index);
        return encoders.int16BE.pack(index);
    }
}