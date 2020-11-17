import { Versionstamp } from '@openland/foundationdb-tuple';
import { Locations } from './Locations';
import { inTxLock } from 'openland-module-db/inTxLock';
import { Context } from '@openland/context';
import { TransactionCache, VersionstampRef, Subspace, TupleItem, encoders, getTransaction } from '@openland/foundationdb';

const subscriberUpdates = new TransactionCache<{
    latest: { vt: VersionstampRef },
}>('feed-subscriber-updates-ephemeral');

export class SubscriberEphemeralRepository {

    readonly subspace: Subspace<TupleItem[], TupleItem[]>;

    constructor(subspace: Subspace) {
        this.subspace = subspace
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.tuple);
    }

    async writeEphemeralChanged(ctx: Context, subscriber: Buffer, feed: Buffer, vt: VersionstampRef) {
        let subscriberKey = subscriber.toString('hex');
        let feedKey = feed.toString('hex');
        let key = subscriberKey + '-' + feedKey;

        await inTxLock(ctx, 'ephemeral-updated-' + key, async () => {
            let ex = subscriberUpdates.get(ctx, key);
            if (ex) {
                ex.latest = { vt };
            } else {
                // Delete latest
                let latest = await this.subspace.get(ctx, Locations.subscriber.ephemeral.latest(subscriber, feed));
                if (latest) {
                    let latestVt = latest[0] as Versionstamp;
                    this.subspace.clear(ctx, Locations.subscriber.ephemeral.read(subscriber, latestVt));
                }

                // Save next latest
                ex = { latest: { vt } };
                subscriberUpdates.set(ctx, key, ex);

                // Schedule write
                getTransaction(ctx).beforeCommit(async (commit) => {
                    // Write new latest
                    this.subspace.setTupleValue(commit, Locations.subscriber.ephemeral.latest(subscriber, feed), [ex!.latest.vt]);

                    // Write to change feed
                    this.subspace.setTupleKey(commit, Locations.subscriber.ephemeral.write(subscriber, ex!.latest.vt), [feed]);
                });
            }
        });
    }

    async getUpdatedFeeds(ctx: Context, subscriber: Buffer, after: Buffer) {
        let location = Locations.subscriber.ephemeral.all(subscriber);
        let res = await this.subspace.range(ctx, location, { after: Locations.subscriber.ephemeral.read(subscriber, new Versionstamp(after)) });
        let updated: { feed: Buffer, vt: Buffer }[] = [];
        for (let r of res) {
            let vt = (r.key[r.key.length - 1] as Versionstamp).value;
            let feed = r.value[0] as Buffer;
            updated.push({ feed, vt });
        }
        return updated;
    }
}