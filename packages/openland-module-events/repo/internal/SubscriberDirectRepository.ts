import { Locations } from './Locations';
import { Context } from '@openland/context';
import { Subspace, encoders, TransactionCache, getTransaction } from '@openland/foundationdb';
import { inTxLock } from 'openland-module-db/inTxLock';

const ZERO = Buffer.alloc(0);
const subscriberUpdates = new TransactionCache<{ latest: { index: Buffer, seq: number } }>('feed-subscriber-updates');

export class SubscriberDirectRepository {
    readonly subspace: Subspace;

    constructor(subspace: Subspace) {
        this.subspace = subspace;
    }

    async addSubscriber(ctx: Context, subscriber: Buffer, feed: Buffer) {
        this.subspace.set(ctx, Locations.subscriber.direct(subscriber, feed), ZERO);
        this.subspace.set(ctx, Locations.subscriber.directReverse(subscriber, feed), ZERO);
    }

    async removeSubscriber(ctx: Context, subscriber: Buffer, feed: Buffer) {
        this.subspace.clear(ctx, Locations.subscriber.direct(subscriber, feed));
        this.subspace.clear(ctx, Locations.subscriber.directReverse(subscriber, feed));
    }

    async getFeedSubscribers(ctx: Context, feed: Buffer) {
        let direct = await this.subspace.range(ctx, Locations.subscriber.directReverseAll(feed));
        let res: Buffer[] = [];
        for (let d of direct) {
            let tuple = encoders.tuple.unpack(d.key);
            res.push(tuple[tuple.length - 1] as Buffer);
        }
        return res;
    }

    async getSubscriberFeeds(ctx: Context, subscriber: Buffer) {
        let direct = await this.subspace.range(ctx, Locations.subscriber.directAll(subscriber));
        let res: Buffer[] = [];
        for (let d of direct) {
            let tuple = encoders.tuple.unpack(d.key);
            res.push(tuple[tuple.length - 1] as Buffer);
        }
        return res;
    }

    async removeUpdatedReference(ctx: Context, subscriber: Buffer, feed: Buffer) {
        let feedKey = feed.toString('hex');
        await inTxLock(ctx, 'direct-updated-' + feedKey, async () => {
            // Updated reference already removed
            if (subscriberUpdates.get(ctx, feedKey)) {
                return;
            }

            // Read latest and clear if exist
            let existing = await this.subspace.get(ctx, Locations.subscriber.directLatest(feed));
            if (existing) {
                this.subspace.clear(ctx, Buffer.concat([Locations.subscriber.directUpdates(subscriber), existing]));
            }
        });
    }

    async setUpdatedReference(ctx: Context, feed: Buffer, seq: number, index: Buffer) {
        let feedKey = feed.toString('hex');
        await inTxLock(ctx, 'direct-updated-' + feedKey, async () => {
            let ex = subscriberUpdates.get(ctx, feedKey);
            if (!ex) {
                ex = { latest: { seq, index } };
                subscriberUpdates.set(ctx, feedKey, ex);

                // Delete existing
                let existing = await this.subspace.get(ctx, Locations.subscriber.directLatest(feed));
                if (existing) {
                    for (let subscriber of await this.getFeedSubscribers(ctx, feed)) {
                        this.subspace.clear(ctx, Buffer.concat([Locations.subscriber.directUpdates(subscriber), existing]));
                    }
                }

                getTransaction(ctx).beforeCommit(async (commit) => {
                    // Save written latest
                    this.subspace.setVersionstampedValue(ctx, Locations.subscriber.directLatest(feed), ZERO, index);

                    // Update updated list
                    for (let subscriber of await this.getFeedSubscribers(ctx, feed)) {
                        this.subspace.setVersionstampedKey(commit, Locations.subscriber.directUpdates(subscriber), encoders.tuple.pack([feed, ex!.latest!.seq]), ex!.latest!.index);
                    }
                });
            } else {
                ex.latest = { seq, index };
            }
        });
    }

    async getUpdatedFeeds(ctx: Context, subscriber: Buffer, after: Buffer) {
        let location = Locations.subscriber.directUpdates(subscriber);
        let res = await this.subspace.range(ctx, location, { after: Buffer.concat([location, after]) });
        let updated: { feed: Buffer, seq: number, state: Buffer }[] = [];
        for (let r of res) {
            let state = r.key.slice(r.key.length - 12);
            let tuple = encoders.tuple.unpack(r.value);
            let feed = tuple[0] as Buffer;
            let seq = tuple[1] as number;
            updated.push({ feed, seq, state });
        }
        return updated;
    }
}