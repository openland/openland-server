import { Versionstamp, VersionstampRef } from '@openland/foundationdb-tuple';
import { Locations } from './Locations';
import { Context } from '@openland/context';
import { Subspace, encoders, TransactionCache, getTransaction, TupleItem } from '@openland/foundationdb';
import { inTxLock } from 'openland-module-db/inTxLock';

const subscriberUpdates = new TransactionCache<{
    latest: { seq: number, vt: VersionstampRef },
    previous: { seq: number, vt: Versionstamp } | null
}>('feed-subscriber-updates');

export class SubscriberDirectRepository {
    readonly subspace: Subspace<TupleItem[], TupleItem[]>;

    constructor(subspace: Subspace) {
        this.subspace = subspace
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.tuple);
    }

    async addSubscriber(ctx: Context, subscriber: Buffer, feed: Buffer) {
        this.subspace.set(ctx, Locations.subscriber.direct(subscriber, feed), []);
        this.subspace.set(ctx, Locations.feed.direct(feed, subscriber), []);
    }

    async removeSubscriber(ctx: Context, subscriber: Buffer, feed: Buffer) {
        this.subspace.clear(ctx, Locations.subscriber.direct(subscriber, feed));
        this.subspace.clear(ctx, Locations.feed.direct(feed, subscriber));
    }

    async getFeedSubscribers(ctx: Context, feed: Buffer) {
        let direct = await this.subspace.range(ctx, Locations.feed.directAll(feed));
        let res: Buffer[] = [];
        for (let d of direct) {
            res.push(d.key[d.key.length - 1] as Buffer);
        }
        return res;
    }

    async getSubscriberFeeds(ctx: Context, subscriber: Buffer) {
        let direct = await this.subspace.range(ctx, Locations.subscriber.directAll(subscriber));
        let res: Buffer[] = [];
        for (let d of direct) {
            res.push(d.key[d.key.length - 1] as Buffer);
        }
        return res;
    }

    async removeUpdatedReference(ctx: Context, subscriber: Buffer, feed: Buffer, latest: { vt: Versionstamp, seq: number }) {
        let feedKey = feed.toString('hex');
        await inTxLock(ctx, 'direct-updated-' + feedKey, async () => {
            this.subspace.clear(ctx, Locations.subscriber.directUpdatesRead(subscriber, latest.vt));
        });
    }

    async setUpdatedReference(ctx: Context, feed: Buffer, seq: number, vt: VersionstampRef, previous: { vt: Versionstamp, seq: number } | null) {
        let feedKey = feed.toString('hex');
        await inTxLock(ctx, 'direct-updated-' + feedKey, async () => {
            let ex = subscriberUpdates.get(ctx, feedKey);
            if (!ex) {
                ex = { latest: { seq, vt }, previous };
                subscriberUpdates.set(ctx, feedKey, ex);

                // Delete existing
                if (ex.previous) {
                    for (let subscriber of await this.getFeedSubscribers(ctx, feed)) {
                        this.subspace.clear(ctx, Locations.subscriber.directUpdatesRead(subscriber, ex.previous.vt));
                    }
                }

                getTransaction(ctx).beforeCommit(async (commit) => {
                    let latest = ex!.latest!;
                    // Update updated list
                    for (let subscriber of await this.getFeedSubscribers(commit, feed)) {
                        this.subspace.setTupleKey(commit, Locations.subscriber.directUpdatesWrite(subscriber, latest.vt), [feed, latest.seq]);
                    }
                    subscriberUpdates.delete(ctx, feedKey);
                });
            } else {
                ex.latest = { seq, vt };
            }
        });
    }

    async getUpdatedFeeds(ctx: Context, subscriber: Buffer, after: Buffer) {
        let location = Locations.subscriber.directUpdatesAll(subscriber);
        let res = await this.subspace.range(ctx, location, { after: Locations.subscriber.directUpdatesRead(subscriber, new Versionstamp(after)) });
        let updated: { feed: Buffer, seq: number, vt: Buffer }[] = [];
        for (let r of res) {
            let vt = (r.key[r.key.length - 1] as Versionstamp).value;
            let feed = r.value[0] as Buffer;
            let seq = r.value[1] as number;
            updated.push({ feed, seq, vt });
        }
        return updated;
    }
}