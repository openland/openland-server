import { Locations } from './Locations';
import { Subspace, encoders, TupleItem } from '@openland/foundationdb';
import { Context } from '@openland/context';

export class FeedSeqRepository {

    readonly subspace: Subspace<TupleItem[], number>;

    constructor(subspace: Subspace) {
        this.subspace = subspace
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.int32LE);
    }

    /**
     * Overwrites current sequence number for a feed
     * @param ctx  context
     * @param feed feed
     * @param seq  new sequence number
     */
    setSeq(ctx: Context, feed: Buffer, seq: number) {
        this.subspace.set(ctx, Locations.feed.seq(feed), seq);
    }

    /**
     * Reads sequence number of a feed
     * @param ctx context
     * @param feed feed
     */
    async getSeq(ctx: Context, feed: Buffer) {
        let ex = await this.subspace.get(ctx, Locations.feed.seq(feed));
        if (ex === null) {
            throw Error('No seq counter found');
        }
        return ex;
    }

    /**
     * Allocates next unique sequence number.
     * 
     * NOTE: This method is NOT concurrency friendly.
     * 
     * @param ctx context
     * @param feed feed
     */
    async allocateSeq(ctx: Context, feed: Buffer) {
        let key = Locations.feed.seq(feed);
        let existing = await this.subspace.get(ctx, key);
        if (existing === null) {
            throw Error('No seq counter found');
        }
        let seq = existing + 1;
        this.subspace.set(ctx, key, seq);
        return seq;
    }
}