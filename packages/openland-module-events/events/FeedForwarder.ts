import { EventsRepository } from './../repo/EventsRepository';
import { TxVariable } from './utils/TxVariable';
import { inTxLeaky } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { SeqTracker, seqTrackerCreate, seqTrackerReceive } from './utils/SeqTracker';

/**
 * This class selectively decides what updates to forward to a subscriber
 * and able to synchronize state in the case if some updates was lost in the
 * process.
 * 
 * NOTE: This class is not concurrency-safe and all operations must be guarded with
 * an AsyncLock by using class
 */
export class FeedForwarder {
    readonly feed: Buffer;
    readonly subscriber: Buffer;
    private readonly _repo: EventsRepository;
    private readonly _seqTracker = new TxVariable<SeqTracker | null>(null);

    constructor(feed: Buffer, subscriber: Buffer, repo: EventsRepository) {
        this.feed = feed;
        this.subscriber = subscriber;
        this._repo = repo;
    }

    get isSubscribed() {
        return !!this._seqTracker.getWritten();
    }

    /**
     * Starting feed forwarder from specific point in time. 
     * This method is transaction friendly.
     * 
     * @param parent context
     * @param seq    sequence number
     * @param state  state
     */
    start = async (parent: Context, seq: number, state: Buffer) => {

        //
        // Resolve difference and actual state of subscription
        // We are doing subscription check here to avoid requirement
        // of outer code to call "start" always in appropriate state (subscribed)
        //
        // Resolving feed updates is to guarantee that we have not missed any updates.
        // This is useful when outer code create and destroy forwarder and could simply miss 
        // some updates from EventBus because of delay of creation of forwarder and update push
        //

        return await inTxLeaky(parent, async (ctx) => {
            let missingUpdates: RawEvent[] = [];
            let from: { seq: number, state: Buffer } | null = null;
            let subscribedSince = await this._storage.subscribedSince(ctx, { feed: this.feed, subscriber: this.subscriber });
            if (subscribedSince) {
                let latestSeq = await this._storage.getFeedSeq(ctx, this.feed);
                if (seq < latestSeq) {
                    let after = state;
                    let hasMore = true;
                    while (hasMore) {
                        let updates = await this._storage.getFeedUpdates(ctx, this.feed, { mode: 'forward', after, limit: 10 });
                        for (let u of updates.updates) {
                            missingUpdates.push(u);
                        }
                        hasMore = updates.hasMore;
                        after = updates.updates[updates.updates.length - 1].id;
                    }
                    let latestState = await this._storage.getFeedLatest(ctx, this.feed);
                    if (!latestState) {
                        latestState = subscribedSince;
                    }
                    from = { seq: latestSeq, state: latestState };
                } else {
                    from = { seq, state };
                }
            }

            //
            // This is not a typical usage of a combination of internal state usage and transactions.
            // Typically you mutate state only after transaction, but since there could be multiple calls
            // of other methods within a single transaction and/or there could be wrapped in external transaction
            // this code have to be executed right in place instead of executing after successful commit.
            // 
            // This code uses special TxVariable that respects transaction retrying.
            //
            if (from) {
                this._seqTracker.set(ctx, seqTrackerCreate(from.seq, from.state));
            } else {
                this._seqTracker.set(ctx, null);
            }

            return missingUpdates;
        });
    }

    /**
     * Reloads subscription state
     * @param parent context
     */
    receiveStateChange = async (parent: Context) => {
        return await inTxLeaky(parent, async (ctx) => {
            let wasStopped = false;
            let wasStarted = false;
            let missingUpdates: RawEvent[] = [];

            let subscribedSince = await this._storage.subscribedSince(ctx, { feed: this.feed, subscriber: this.subscriber });
            let tracker = this._seqTracker.get(ctx);
            if (subscribedSince && !tracker) {
                wasStarted = true;

                // Read latest and seq
                let feedSeq = await this._storage.getFeedSeq(ctx, this.feed);
                let feedLatest = await this._storage.getFeedLatest(ctx, this.feed);
                if (!feedLatest) {
                    feedLatest = subscribedSince!;
                }

                // Read missing updates
                let after = subscribedSince;
                let hasMore = true;
                while (hasMore) {
                    let updates = await this._storage.getFeedUpdates(ctx, this.feed, { mode: 'forward', after, limit: 10 });
                    for (let u of updates.updates) {
                        // NOTE: We put all updates here and not filtering one with the same seq since otherwise tracker will
                        //       exclude initial update because it could be before validated seq
                        missingUpdates.push(u);
                    }
                    hasMore = updates.hasMore;
                    after = updates.updates[updates.updates.length - 1].id;
                }

                // Create tracker
                this._seqTracker.set(ctx, seqTrackerCreate(feedSeq, feedLatest));
            } else if (!subscribedSince && tracker) {
                wasStopped = true;

                // Destroy tracker
                this._seqTracker.set(ctx, null);
            }

            return {
                wasStarted, wasStopped, missingUpdates
            };
        });
    }

    /**
     * Handle on update received
     * @param parent context
     * @param seq    sequence number
     * @param id     update id
     */
    receiveUpdate = async (parent: Context, seq: number, id: Buffer) => {
        return await inTxLeaky(parent, async (ctx) => {
            let shouldForward = false;
            let { wasStarted, wasStopped, missingUpdates } = await this.receiveStateChange(ctx);

            // Update tracker
            let ex = this._seqTracker.get(ctx);
            if (ex) {
                let r = seqTrackerReceive(ex, seq, id);
                if (r.handle) {
                    shouldForward = true;
                }
                this._seqTracker.set(ctx, r.state);
            }

            return {
                wasStarted,
                wasStopped,
                missingUpdates,
                shouldForward
            };
        });
    }

    synchronize = async (parent: Context) => {
        return await inTxLeaky(parent, async (ctx) => {
            let { wasStarted, wasStopped, missingUpdates } = await this.receiveStateChange(ctx);

            // Check for missing updates
            if (!wasStarted && !wasStopped) {
                let tracker = this._seqTracker.get(ctx);
                if (tracker) {
                    let seq = await this._storage.getFeedSeq(ctx, this.feed);
                    if (tracker.validated.seq < seq) {
                        let after = tracker.validated.state;
                        let hasMore = true;
                        while (hasMore) {
                            let updates = await this._storage.getFeedUpdates(ctx, this.feed, { mode: 'forward', after, limit: 10 });
                            for (let u of updates.updates) {
                                missingUpdates.push(u);
                            }
                            hasMore = updates.hasMore;
                            after = updates.updates[updates.updates.length - 1].id;
                        }
                    }
                }
            }

            return {
                wasStarted,
                wasStopped,
                missingUpdates
            };
        });
    }
}