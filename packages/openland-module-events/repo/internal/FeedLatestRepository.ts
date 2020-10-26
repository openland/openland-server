import { VersionstampRef, Versionstamp, TupleItem } from '@openland/foundationdb-tuple';
import { Locations } from './Locations';
import { Context } from '@openland/context';
import { Subspace, encoders, TransactionCache } from '@openland/foundationdb';

const feedFirstLatestCache = new TransactionCache<{ latest: { vt: Versionstamp, seq: number } | null }>('feed-index-latest');

export class FeedLatestRepository {

    readonly subspace: Subspace<TupleItem[], TupleItem[]>;

    constructor(subspace: Subspace) {
        this.subspace = subspace
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.tuple);
    }

    /**
     * Writes reference to a latest event.
     * 
     * NOTE: After successful write you are no longer able to read reference to a 
     * latest value in the same transaction. Use readFirstTransactionLatest to read
     * previous value of a latest event.
     * 
     * @param parent context
     * @param feed feed
     * @param seq event sequence number
     * @param index event versionstamp index
     */
    async writeLatest(ctx: Context, feed: Buffer, seq: number, vt: VersionstampRef) {

        // Read existing latest into cache
        await this.readFirstTransactionLatest(ctx, feed);

        // Write latest
        this.subspace.setTupleValue(ctx, Locations.feed.latest(feed), [seq, vt]);
    }

    /**
     * Reads latest event reference before any writes in the current transaction.
     * @param ctx context
     * @param feed feed
     */
    async readFirstTransactionLatest(ctx: Context, feed: Buffer) {
        let feedKey = feed.toString('hex');
        let existing = feedFirstLatestCache.get(ctx, feedKey);
        if (!existing) {
            let latest = await this.subspace.get(ctx, Locations.feed.latest(feed));
            if (!latest) {
                feedFirstLatestCache.set(ctx, feedKey, { latest: null });
                return null;
            }
            let seq = latest[0] as number;
            let vt = (latest[1] as Versionstamp);
            feedFirstLatestCache.set(ctx, feedKey, { latest: { vt, seq } });
            return { vt, seq };
        }
        return existing.latest;
    }

    /**
     * Reads latest reference. NOTE: this method could not be called in the same transaction as writeLatest.
     * 
     * @param ctx context
     * @param feed feed
     */
    async readLatest(ctx: Context, feed: Buffer) {
        let latest = await this.subspace.get(ctx, Locations.feed.latest(feed));
        if (!latest) {
            throw Error('Unable to find latest event reference');
        }
        let seq = latest[0] as number;
        let vt = latest[1] as Versionstamp;
        return { vt, seq };
    }
}