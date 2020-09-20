import { RawEvent } from '../EventsRepository';
import { Locations } from './Locations';
import { Context } from '@openland/context';
import { Subspace, encoders, TransactionCache, getTransaction } from '@openland/foundationdb';

type PendingEvent = { seq: number, index: Buffer, event: Buffer };
const feedFirstLatestCache = new TransactionCache<{ latest: { state: Buffer, seq: number } | null }>('feed-index-latest');
const feedPostEventCache = new TransactionCache<{ pending: PendingEvent[] }>('feed-index-post');

/**
 * This repository contains all low level operations for working with feed
 */
export class FeedRepository {

    readonly subspace: Subspace;

    constructor(subspace: Subspace) {
        this.subspace = subspace;
    }

    //
    // SeqNo allocations
    //

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

    //
    // Latest Reference
    //

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

    //
    // Event Stream
    //

    /**
     * Write event to a feed
     * @param parent context
     * @param feed feed
     * @param event event body
     * @param seq event sequence number
     * @param index event versionstamp index
     */
    async writeEvent(ctx: Context, feed: Buffer, event: Buffer, seq: number, index: Buffer) {
        let feedKey = feed.toString('hex');
        let post = feedPostEventCache.get(ctx, feedKey);
        let location = Locations.feedStream(feed);

        if (!post) {
            post = { pending: [] };
            feedPostEventCache.set(ctx, feedKey, post);
            getTransaction(ctx).beforeCommit(async (tx) => {
                for (let pending of post!.pending) {
                    this.subspace.setVersionstampedKey(tx, location, encoders.tuple.pack([pending.seq, pending.event]), pending.index);
                }
            });
        }

        post.pending.push({ seq, index, event });
    }

    /**
     * Loads events
     * @param parent context
     * @param feed feed
     * @param opts parameters or read operation
     */
    async getEvents(ctx: Context, feed: Buffer, opts: { mode: 'forward' | 'only-latest', limit: number, after?: Buffer, before?: Buffer }) {
        let location = Locations.feedStream(feed);
        let start = opts.after ? Buffer.concat([location, opts.after]) : undefined;
        let end = opts.before ? Buffer.concat([location, opts.before]) : undefined;
        let read = opts.mode === 'forward'
            ? await this.subspace.range(ctx, location, { after: start, before: end, reverse: false, limit: opts.limit + 1 })
            : await this.subspace.range(ctx, location, { before: start, after: end, reverse: true, limit: opts.limit + 1 });
        let events: RawEvent[] = [];
        for (let i = 0; i < Math.min(opts.limit, read.length); i++) {
            let r = read[i];
            let id = r.key.slice(r.key.length - 12);
            let value = encoders.tuple.unpack(r.value);
            let seq = value[0] as number;
            let event = value[1] as Buffer;
            if (opts.mode === 'only-latest') {
                events.unshift({ id, seq, event });
            } else {
                events.push({ id, seq, event });
            }
        }
        return { events, hasMore: read.length > opts.limit };
    }
}