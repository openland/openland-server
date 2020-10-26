import { TupleItem, VersionstampRef, Versionstamp } from '@openland/foundationdb-tuple';
import { RawEvent } from './RawEvent';
import { Locations } from './Locations';
import { Context } from '@openland/context';
import { Subspace, encoders, TransactionCache, getTransaction } from '@openland/foundationdb';

type PendingEvent = { seq: number, vt: VersionstampRef, event: Buffer };
const feedPostEventCache = new TransactionCache<{ pending: PendingEvent[] }>('feed-index-post');
const feedPostEventCollapsedCache = new TransactionCache<{ pending: { [key: string]: PendingEvent } }>('feed-index-post-collapsed');

/**
 * This repository contains all low level operations for working with feed
 */
export class FeedEventsRepository {

    readonly subspace: Subspace<TupleItem[], TupleItem[]>;

    constructor(subspace: Subspace) {
        this.subspace = subspace
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.tuple);
    }

    /**
     * Write event to a feed
     * @param ctx context
     * @param feed feed
     * @param event event body
     * @param seq event sequence number
     * @param vt event versionstamp
     */
    writeEvent(ctx: Context, feed: Buffer, event: Buffer, seq: number, vt: VersionstampRef) {
        let feedKey = feed.toString('hex');
        let post = feedPostEventCache.get(ctx, feedKey);

        if (!post) {
            post = { pending: [] };
            feedPostEventCache.set(ctx, feedKey, post);
            getTransaction(ctx).beforeCommit(async (tx) => {
                for (let pending of post!.pending) {
                    this.subspace.setTupleKey(tx,
                        Locations.feed.streamItemWrite(feed, pending.vt),
                        [pending.seq, pending.event]
                    );
                }
            });
        }

        post.pending.push({ seq, vt, event });
    }

    /**
     * Write collapsed event to a feed
     * @param ctx context
     * @param feed feed
     * @param event event body
     * @param seq event sequence number
     * @param vt event versionstamp
     * @param collapseKey event collapse key
     */
    async writeCollapsedEvent(ctx: Context, feed: Buffer, event: Buffer, seq: number, vt: VersionstampRef, collapseKey: string) {
        let feedKey = feed.toString('hex');
        let post = feedPostEventCollapsedCache.get(ctx, feedKey);
        let referenceLocation = Locations.feed.collapsed(feed, collapseKey);

        if (!post) {
            post = { pending: {} };
            feedPostEventCollapsedCache.set(ctx, feedKey, post);

            getTransaction(ctx).beforeCommit(async (tx) => {
                for (let key of Object.keys(post!.pending)) {
                    let pending = post!.pending[key]!;
                    this.subspace.setTupleKey(tx,
                        Locations.feed.streamItemWrite(feed, pending.vt),
                        [pending.seq, pending.event]
                    );
                    this.subspace.setTupleValue(tx, referenceLocation, [seq, pending.vt]);
                }
            });
        }

        // Remove existing
        if (!post.pending[collapseKey]) {
            let existing = await this.subspace.get(ctx, referenceLocation);
            if (existing) {
                this.subspace.clear(ctx, Locations.feed.streamItem(feed, existing[1] as Versionstamp));
            }
        }

        // Save pending
        post.pending[collapseKey] = { seq, vt, event };
    }

    /**
     * Loads events
     * @param parent context
     * @param feed feed
     * @param opts parameters or read operation
     */
    async getEvents(ctx: Context, feed: Buffer, opts: { mode: 'forward' | 'only-latest', limit: number, after?: Buffer, before?: Buffer }) {
        let location = Locations.feed.stream(feed);
        let start = opts.after ? Locations.feed.streamItem(feed, new Versionstamp(opts.after)) : undefined;
        let end = opts.before ? Locations.feed.streamItem(feed, new Versionstamp(opts.before)) : undefined;
        let read = opts.mode === 'forward'
            ? await this.subspace.range(ctx, location, { after: start, before: end, reverse: false, limit: opts.limit + 1 })
            : await this.subspace.range(ctx, location, { before: start, after: end, reverse: true, limit: opts.limit + 1 });
        let events: RawEvent[] = [];
        for (let i = 0; i < Math.min(opts.limit, read.length); i++) {
            let r = read[i];
            let vt = (r.key[r.key.length - 1] as Versionstamp).value;
            let seq = r.value[0] as number;
            let event = r.value[1] as Buffer;
            if (opts.mode === 'only-latest') {
                events.unshift({ vt, seq, event });
            } else {
                events.push({ vt, seq, event });
            }
        }
        return { events, hasMore: read.length > opts.limit };
    }
}