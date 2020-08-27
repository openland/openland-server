import { AsyncLock } from 'openland-utils/timer';
import { RawEvent } from '../repo/EventsStorage';
import { EventsStorage } from '../repo/EventsStorage';
import { SeqTracker } from '../utils/SeqTracker';
import { Context } from '@openland/context';

export class FeedTracker {
    readonly feed: Buffer;
    readonly storage: EventsStorage;
    private readonly seqTracker: SeqTracker;
    private lock = new AsyncLock();

    constructor(feed: Buffer, initialSeq: number, initialState: Buffer, storage: EventsStorage) {
        this.feed = feed;
        this.storage = storage;
        this.seqTracker = new SeqTracker(initialSeq, initialState);
    }

    get isInvalidated() {
        return this.seqTracker.validatedSeq < this.seqTracker.maxReceivedSeq;
    }

    receiveUpdate = async (seq: number, state: Buffer): Promise<{ shouldHandle: boolean, invalidated: boolean }> => {
        return await this.lock.inLock(async () => {
            if (!this.seqTracker.seqReceived(seq, state)) {
                return { shouldHandle: false, invalidated: this.isInvalidated };
            }

            return { shouldHandle: true, invalidated: this.isInvalidated };
        });
    }

    synchronize = async (ctx: Context): Promise<RawEvent | null> => {
        return await this.lock.inLock(async () => {
            // Load current feed seq
            let seq = await this.storage.getFeedSeq(ctx, this.feed);

            // Check if seq tracker is already received sequence up to current seq
            if (this.seqTracker.validatedSeq >= seq) {
                return null;
            }

            // Read missing last update
            let top = await this.storage.getFeedUpdates(ctx, this.feed, { mode: 'only-latest', limit: 1, after: this.seqTracker.validatedState });
            if (top.updates.length === 1) {
                this.seqTracker.sequenceRestored(top.updates[0].seq, top.updates[0].id);
                return top.updates[0];
            } else {
                throw Error('Invalid response');
            }
        });
    }
}