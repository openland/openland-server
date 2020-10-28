import { Context } from '@openland/context';
import { Subspace, inTxLeaky, encoders } from '@openland/foundationdb';
import { inTxLock } from 'openland-module-db/inTxLock';

const SUBSPACE_TIMEOUT = 0;
const SUBSPACE_SEQ = 1;

/**
 * Allocation if sequence number for specific subscribers
 */
export class SubscriberSeqRepository {
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
            return await inTxLock(ctx, 'seq-' + subscriber.toString('hex'), async () => {
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
            return await inTxLock(ctx, 'seq-' + subscriber.toString('hex'), async () => {
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
     * Get subscriber online expiration time
     * @param parent context
     * @param subscriber subscriber
     */
    async getOnlineExpires(parent: Context, subscriber: Buffer) {
        return await inTxLeaky(parent, async (ctx) => {
            let ex = await this.directory.snapshotGet(ctx, encoders.tuple.pack([subscriber, SUBSPACE_TIMEOUT]));
            if (!ex) {
                return null;
            } else {
                return encoders.int32LE.unpack(ex);
            }
        });
    }

    /**
     * Refresh online expiration
     * @param parent context
     * @param subscriber subscriber id
     * @param expires expiration time in seconds
     */
    async refreshOnline(parent: Context, subscriber: Buffer, expires: number) {
        await inTxLeaky(parent, async (ctx) => {
            this.directory.set(ctx, encoders.tuple.pack([subscriber, SUBSPACE_TIMEOUT]), encoders.int32LE.pack(expires));
        });
    }
}