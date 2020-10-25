import { RawEvent } from './RawEvent';
import { Locations } from './Locations';
import { Context } from '@openland/context';
import { Subspace, encoders, TransactionCache, getTransaction } from '@openland/foundationdb';

const ZERO = Buffer.alloc(0);
type PendingEvent = { seq: number, index: Buffer, event: Buffer };
const feedPostEventCache = new TransactionCache<{ pending: PendingEvent[] }>('feed-index-post');
const feedPostEventCollapsedCache = new TransactionCache<{ pending: { [key: string]: PendingEvent } }>('feed-index-post-collapsed');

/**
 * This repository contains all low level operations for working with feed
 */
export class FeedEventsRepository {

    readonly subspace: Subspace;

    constructor(subspace: Subspace) {
        this.subspace = subspace;
    }

    /**
     * Write event to a feed
     * @param ctx context
     * @param feed feed
     * @param event event body
     * @param seq event sequence number
     * @param index event versionstamp index
     */
    writeEvent(ctx: Context, feed: Buffer, event: Buffer, seq: number, index: Buffer) {
        let feedKey = feed.toString('hex');
        let post = feedPostEventCache.get(ctx, feedKey);
        let location = Locations.feed.stream(feed);

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
     * Write collapsed event to a feed
     * @param ctx context
     * @param feed feed
     * @param event event body
     * @param seq event sequence number
     * @param index event versionstamp index
     * @param collapseKey event collapse key
     */
    async writeCollapsedEvent(ctx: Context, feed: Buffer, event: Buffer, seq: number, index: Buffer, collapseKey: string) {
        let feedKey = feed.toString('hex');
        let post = feedPostEventCollapsedCache.get(ctx, feedKey);
        let location = Locations.feed.stream(feed);
        let referenceLocation = Locations.feed.collapsed(feed, collapseKey);

        if (!post) {
            post = { pending: {} };
            feedPostEventCollapsedCache.set(ctx, feedKey, post);

            getTransaction(ctx).beforeCommit(async (tx) => {
                for (let key of Object.keys(post!.pending)) {
                    let pending = post!.pending[key]!;
                    this.subspace.setVersionstampedKey(tx, location, encoders.tuple.pack([pending.seq, pending.event]), pending.index);
                    this.subspace.setVersionstampedValue(tx, referenceLocation, ZERO, pending.index);
                }
            });
        }

        // Remove existing
        if (!post.pending[collapseKey]) {
            let existing = await this.subspace.get(ctx, referenceLocation);
            if (existing) {
                this.subspace.clear(ctx, Buffer.concat([Locations.feed.stream(feed), existing]));
            }
        }

        // Save pending
        post.pending[collapseKey] = { seq, index, event };
    }

    /**
     * Loads events
     * @param parent context
     * @param feed feed
     * @param opts parameters or read operation
     */
    async getEvents(ctx: Context, feed: Buffer, opts: { mode: 'forward' | 'only-latest', limit: number, after?: Buffer, before?: Buffer }) {
        let location = Locations.feed.stream(feed);
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