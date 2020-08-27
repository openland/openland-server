import { Context } from '@openland/context';
import { Subspace, inTxLeaky, encoders } from '@openland/foundationdb';

const SUBSPACE_TIMEOUT = 0;
const SUBSPACE_SEQ = 1;

export class SeqRepository {
    private directory: Subspace;

    constructor(directory: Subspace) {
        this.directory = directory;
    }

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
            return seq;
        });
    }

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

    async allocateSeqIfOnline(parent: Context, subscriber: Buffer, now: number) {
        return await inTxLeaky(parent, async (ctx) => {
            let ex = await this.directory.snapshotGet(ctx, encoders.tuple.pack([subscriber, SUBSPACE_TIMEOUT]));
            if (!ex) {
                return null;
            } else {
                let nowClamped = Math.floor(now / 1000);
                let timeout = encoders.int32LE.unpack(ex);
                if (timeout < nowClamped) {
                    return null;
                }
            }
            return this.allocateSeq(ctx, subscriber);
        });
    }

    async refreshOnline(parent: Context, subscriber: Buffer, expires: number) {
        await inTxLeaky(parent, async (ctx) => {
            let expiration = Math.floor(expires / 1000);
            this.directory.max(ctx, encoders.tuple.pack([subscriber, SUBSPACE_TIMEOUT]), encoders.int32LE.pack(expiration));
        });
    }
}