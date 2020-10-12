import { Locations } from './Locations';
import { Subspace, encoders } from '@openland/foundationdb';
import { Context } from '@openland/context';

export class FeedSeqRepository {

    readonly subspace: Subspace;

    constructor(subspace: Subspace) {
        this.subspace = subspace;
    }

    /**
     * Overwrites current sequence number for a feed
     * @param ctx  context
     * @param feed feed
     * @param seq  new sequence number
     */
    setSeq(ctx: Context, feed: Buffer, seq: number) {
        this.subspace.set(ctx, Locations.feedSeq(feed), encoders.int32LE.pack(seq));
    }

    /**
     * Reads sequence number of a feed
     * @param ctx context
     * @param feed feed
     */
    async getSeq(ctx: Context, feed: Buffer) {
        let ex = await this.subspace.get(ctx, Locations.feedSeq(feed));
        if (!ex) {
            throw Error('No seq counter found');
        }
        return encoders.int32LE.unpack(ex);
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
        let key = Locations.feedSeq(feed);
        let existing = await this.subspace.get(ctx, key);
        if (!existing) {
            throw Error('No seq counter found');
        }
        let seq = encoders.int32LE.unpack(existing) + 1;
        this.subspace.set(ctx, key, encoders.int32LE.pack(seq));
        return seq;
    }
}