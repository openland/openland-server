import { Locations } from './Locations';
import { Context } from '@openland/context';
import { Subspace, encoders, TransactionCache } from '@openland/foundationdb';

const feedFirstLatestCache = new TransactionCache<{ latest: { state: Buffer, seq: number } | null }>('feed-index-latest');

export class FeedLatestRepository {
    readonly subspace: Subspace;

    constructor(subspace: Subspace) {
        this.subspace = subspace;
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
    async writeLatest(ctx: Context, feed: Buffer, seq: number, index: Buffer) {

        // Read existing latest into cache
        await this.readFirstTransactionLatest(ctx, feed);

        // Write latest
        this.subspace.setVersionstampedValue(ctx, Locations.feedLatest(feed), encoders.int32LE.pack(seq), index);
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
            let latest = await this.subspace.get(ctx, Locations.feedLatest(feed));
            if (!latest) {
                feedFirstLatestCache.set(ctx, feedKey, { latest: null });
                return null;
            }
            let seq = encoders.int32LE.unpack(latest.slice(0, 4));
            let state = latest.slice(4);
            feedFirstLatestCache.set(ctx, feedKey, { latest: { state, seq } });
            return { state, seq };
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
        let latest = await this.subspace.get(ctx, Locations.feedLatest(feed));
        if (!latest) {
            throw Error('Unable to find latest event reference');
        }
        let seq = encoders.int32LE.unpack(latest.slice(0, 4));
        let state = latest.slice(4);
        return { state, seq };
    }
}