import { Context } from '@openland/context';
import { Subspace, inTxLeaky, encoders } from '@openland/foundationdb';

const SUBSPACE_TIMEOUT = 0;
const SUBSPACE_SEQ = 1;

/**
 * Allocation if sequence number for specific subscribers
 */
export class SeqRepository {
    private directory: Subspace;

    /**
     * Constructor of sequence repository
     * @param directory subspace for repository
     */
    constructor(directory: Subspace) {
        this.directory = directory;
    }

    /**
     * Reads latest sequence number from snapshot
     * @param parent context
     * @param subscriber subscriber id
     */
    async getCurrentSeqSnapshot(parent: Context, subscriber: Buffer) {
        return await inTxLeaky(parent, async (ctx) => {
            let ex = await this.directory.snapshotGet(ctx, encoders.tuple.pack([subscriber, SUBSPACE_SEQ]));
            if (ex) {
                return encoders.int32LE.unpack(ex);
            } else {
                return 0;
            }
        });
    }

    /**
     * Reads latest sequence number
     * @param parent context
     * @param subscriber subscriber id
     */
    async getCurrentSeq(parent: Context, subscriber: Buffer) {
        return await inTxLeaky(parent, async (ctx) => {
            let ex = await this.directory.get(ctx, encoders.tuple.pack([subscriber, SUBSPACE_SEQ]));
            if (ex) {
                return encoders.int32LE.unpack(ex);
            } else {
                return 0;
            }
        });
    }

    /**
     * Allocate sequence number
     * @param parent context
     * @param subscriber subscriber id
     */
    async allocateSeq(parent: Context, subscriber: Buffer) {
        return await inTxLeaky(parent, async (ctx) => {
            let key = encoders.tuple.pack([subscriber, SUBSPACE_SEQ]);
            let ex = await this.directory.get(ctx, key);
            let seq = 0;
            if (ex) {
                seq = encoders.int32LE.unpack(ex);
            }
            seq++;
            this.directory.set(ctx, key, encoders.int32LE.pack(seq));
            return seq;
        });
    }

    /**
     * Allocate sequence block
     * @param parent context
     * @param subscriber subscriber ie
     * @param blockSize size of the block
     */
    async allocateBlock(parent: Context, subscriber: Buffer, blockSize: number) {
        return await inTxLeaky(parent, async (ctx) => {
            let key = encoders.tuple.pack([subscriber, SUBSPACE_SEQ]);
            let ex = await this.directory.get(ctx, key);
            let seq = 0;
            if (ex) {
                seq = encoders.int32LE.unpack(ex);
            }
            seq += blockSize;
            this.directory.set(ctx, key, encoders.int32LE.pack(seq));
            return seq - blockSize;
        });
    }

    /**
     * Check if subscriber is online
     * @param parent context
     * @param subscriber subscriber id
     * @param now current time in seconds
     */
    async isOnline(parent: Context, subscriber: Buffer, now: number) {
        return await inTxLeaky(parent, async (ctx) => {
            let ex = await this.directory.snapshotGet(ctx, encoders.tuple.pack([subscriber, SUBSPACE_TIMEOUT]));
            if (!ex) {
                return false;
            } else {
                let timeout = encoders.int32LE.unpack(ex);
                if (timeout < now) {
                    return false;
                }
            }
            return true;
        });
    }

    /**
     * Refresh online expiration
     * @param parent context
     * @param subscriber subscriber id
     * @param expires expiration time in seconds
     */
    async refreshOnline(parent: Context, subscriber: Buffer, expires: number) {
        return await inTxLeaky(parent, async (ctx) => {
            let existingRaw = await this.directory.get(ctx, encoders.tuple.pack([subscriber, SUBSPACE_TIMEOUT]));
            let existing: number | null = null;
            if (existingRaw) {
                existing = encoders.int32LE.unpack(existingRaw);
            }
            // Check if existing is already in the future: ignore write
            if (existing && expires < existing) {
                return existing;
            }

            // Write new expiration
            this.directory.set(ctx, encoders.tuple.pack([subscriber, SUBSPACE_TIMEOUT]), encoders.int32LE.pack(expires));

            // Return existing
            if (existing) {
                return existing;
            } else {
                return null;
            }
        });
    }
}