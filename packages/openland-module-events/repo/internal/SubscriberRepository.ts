import { Locations } from './Locations';
import { Context } from '@openland/context';
import { Subspace, encoders, TransactionCache, getTransaction } from '@openland/foundationdb';

const subscriberUpdates = new TransactionCache<{ latest: { index: Buffer, seq: number } }>('feed-subscriber-updates');
const ZERO = Buffer.alloc(0);
const PLUS_ONE = encoders.int32LE.pack(1);
const MODE_DIRECT = 0;
const MODE_ASYNC = 1;

export class SubscriberRepository {
    readonly subspace: Subspace;

    constructor(subspace: Subspace) {
        this.subspace = subspace;
    }

    //
    // Subscriptions
    //

    async getSubscriptionState(ctx: Context, subscriber: Buffer, feed: Buffer): Promise<'direct' | 'direct-strict' | 'async' | null> {
        let ex = await this.subspace.get(ctx, Locations.subscriber.subscription(subscriber, feed));
        if (!ex) {
            return null;
        }
        let tuple = encoders.tuple.unpack(ex);
        if (tuple[0] === MODE_DIRECT) {
            if (tuple[1]) {
                return 'direct-strict';
            } else {
                return 'direct';
            }
        } else if (tuple[0] === MODE_ASYNC) {
            return 'async';
        } else {
            throw Error('Broken index');
        }
    }

    async addSubscription(ctx: Context, subscriber: Buffer, feed: Buffer, mode: 'direct' | 'direct-strict' | 'async', seq: number, index: Buffer) {
        if (await this.subspace.exists(ctx, Locations.subscriber.subscription(subscriber, feed))) {
            throw Error('Subscription already exists');
        }
        let type: Buffer;
        if (mode === 'direct') {
            type = encoders.tuple.pack([MODE_DIRECT, false, seq]);
        } else if (mode === 'direct-strict') {
            type = encoders.tuple.pack([MODE_DIRECT, true, seq]);
        } else if (mode === 'async') {
            type = encoders.tuple.pack([MODE_ASYNC, false, seq]);
        } else {
            throw Error('Invalid mode');
        }
        this.subspace.set(ctx, Locations.subscriber.subscription(subscriber, feed), type);
        this.subspace.set(ctx, Locations.subscriber.direct(subscriber, feed), type);
        this.subspace.set(ctx, Locations.subscriber.directReverse(subscriber, feed), type);
    }

    async addAsyncSubscription(ctx: Context, subscriber: Buffer, feed: Buffer, seq: number, index: Buffer) {
        if (await this.subspace.exists(ctx, Locations.subscriber.subscription(subscriber, feed))) {
            throw Error('Subscription already exists');
        }
        let type = encoders.tuple.pack([MODE_ASYNC, seq]);
        this.subspace.set(ctx, Locations.subscriber.subscription(subscriber, feed), type);
        this.subspace.setVersionstampedValue(ctx, Locations.subscriber.async(subscriber, feed), encoders.int32LE.pack(seq), index);
        this.subspace.add(ctx, Locations.subscriber.asyncVersion(subscriber), PLUS_ONE);
    }

    async removeSubscription(ctx: Context, subscriber: Buffer, feed: Buffer) {
        let mode = await this.getSubscriptionState(ctx, subscriber, feed);
        if (!mode) {
            throw Error('Subscription not exist');
        }

        // Remove from common list
        this.subspace.clear(ctx, Locations.subscriber.subscription(subscriber, feed));

        if (mode === 'direct') {
            // Remove direct subscriber
            this.subspace.clear(ctx, Locations.subscriber.direct(subscriber, feed));
            this.subspace.clear(ctx, Locations.subscriber.directReverse(subscriber, feed));
        } else {
            // Remove async subscriber
            this.subspace.clear(ctx, Locations.subscriber.async(subscriber, feed));
            this.subspace.clearPrefixed(ctx, Locations.subscriber.directUpdates(subscriber));
            this.subspace.add(ctx, Locations.subscriber.asyncVersion(subscriber), PLUS_ONE);
        }
    }

    watchAsyncSubscriptions(ctx: Context, subscriber: Buffer) {
        return this.subspace.watch(ctx, Locations.subscriber.asyncVersion(subscriber));
    }

    //
    // Read subscriptions
    //

    async getFeedDirectSubscribers(ctx: Context, feed: Buffer) {
        let direct = await this.subspace.range(ctx, Locations.subscriber.directReverseAll(feed));
        let res: Buffer[] = [];
        for (let d of direct) {
            let tuple = encoders.tuple.unpack(d.key);
            res.push(tuple[tuple.length - 1] as Buffer);
        }
        return res;
    }

    async getDirectFeeds(ctx: Context, subscriber: Buffer) {
        let direct = await this.subspace.range(ctx, Locations.subscriber.directAll(subscriber));
        let res: Buffer[] = [];
        for (let d of direct) {
            let tuple = encoders.tuple.unpack(d.key);
            res.push(tuple[tuple.length - 1] as Buffer);
        }
        return res;
    }

    async getAsyncFeeds(ctx: Context, subscriber: Buffer) {
        let direct = await this.subspace.range(ctx, Locations.subscriber.asyncAll(subscriber));
        let res: { id: Buffer, since: { state: Buffer, seq: number } }[] = [];
        for (let d of direct) {
            let tuple = encoders.tuple.unpack(d.key);
            let id = tuple[tuple.length - 1] as Buffer;
            let seq = encoders.int32LE.unpack(d.value.slice(0, 4));
            let state = d.value.slice(4);
            res.push({ id, since: { seq, state } });
        }
        return res;
    }

    //
    // Direct subscribers latest references
    //

    async removeUpdatedReference(ctx: Context, subscriber: Buffer, feed: Buffer) {
        let feedKey = feed.toString('hex');
        // Updated reference already removed
        if (subscriberUpdates.get(ctx, feedKey)) {
            return;
        }

        // Read latest and clear if exist
        let existing = await this.subspace.get(ctx, Locations.subscriber.directLatest(feed));
        if (existing) {
            this.subspace.clear(ctx, Buffer.concat([Locations.subscriber.directUpdates(subscriber), existing]));
        }
    }

    async setUpdatedReference(ctx: Context, feed: Buffer, seq: number, index: Buffer) {
        let feedKey = feed.toString('hex');
        let ex = subscriberUpdates.get(ctx, feedKey);
        if (!ex) {
            ex = { latest: { seq, index } };
            subscriberUpdates.set(ctx, feedKey, ex);

            // Delete existing
            let existing = await this.subspace.get(ctx, Locations.subscriber.directLatest(feed));
            if (existing) {
                for (let subscriber of await this.getFeedDirectSubscribers(ctx, feed)) {
                    this.subspace.clear(ctx, Buffer.concat([Locations.subscriber.directUpdates(subscriber), existing]));
                }
            }

            getTransaction(ctx).beforeCommit(async (commit) => {
                // Save written latest
                this.subspace.setVersionstampedValue(ctx, Locations.subscriber.directLatest(feed), ZERO, index);

                // Update updated list
                for (let subscriber of await this.getFeedDirectSubscribers(ctx, feed)) {
                    this.subspace.setVersionstampedKey(commit, Locations.subscriber.directUpdates(subscriber), encoders.tuple.pack([feed, ex!.latest!.seq]), ex!.latest!.index);
                }
            });
        } else {
            ex.latest = { seq, index };
        }
    }

    async getDirectUpdated(ctx: Context, subscriber: Buffer, after: Buffer) {
        let location = Locations.subscriber.directUpdates(subscriber);
        let res = await this.subspace.range(ctx, Locations.subscriber.directUpdates(subscriber), { after: Buffer.concat([location, after]) });
        let updated: { feed: Buffer, seq: number }[] = [];
        for (let r of res) {
            let tuple = encoders.tuple.unpack(r.value);
            let feed = tuple[0] as Buffer;
            let seq = tuple[1] as number;
            updated.push({ feed, seq });
        }
        return updated;
    }
}