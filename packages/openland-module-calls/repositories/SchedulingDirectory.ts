import { Context } from '@openland/context';
import { encoders, inTx, Subspace, withoutTransaction } from '@openland/foundationdb';
import { Store } from 'openland-module-db/FDB';
import { HighContentionAllocator } from 'openland-module-db/HighContentionAllocator';

const SUBSPACE_PID = 0;
const SUBSPACE_ALLOCATOR = 1;

type PeerState = 'adding' | 'ready' | 'removing' | 'removed';

export class SchedulingDirectory {
    readonly subspace: Subspace;
    readonly allocator: HighContentionAllocator;

    constructor(subspace: Subspace) {
        this.subspace = subspace;
        this.allocator = new HighContentionAllocator(subspace.withKeyEncoding(encoders.tuple).subspace([SUBSPACE_ALLOCATOR]));
    }

    async getPeerState(ctx: Context, pid: number): Promise<PeerState | null> {
        const ex = await this.subspace.get(ctx, encoders.tuple.pack([SUBSPACE_PID, pid]));
        if (!ex) {
            return null;
        }
        const type = encoders.int16LE.unpack(ex);
        if (type === 0) {
            return 'adding';
        }
        if (type === 1) {
            return 'ready';
        }
        if (type === 2) {
            return 'removing';
        }
        if (type === 3) {
            return 'removed';
        }
        return null;
    }

    async setPeerState(ctx: Context, pid: number, state: PeerState | null) {
        if (state === 'adding') {
            this.subspace.set(ctx, encoders.tuple.pack([SUBSPACE_PID, pid]), encoders.int16LE.pack(0));
        } else if (state === 'ready') {
            this.subspace.set(ctx, encoders.tuple.pack([SUBSPACE_PID, pid]), encoders.int16LE.pack(1));
        } else if (state === 'removing') {
            this.subspace.set(ctx, encoders.tuple.pack([SUBSPACE_PID, pid]), encoders.int16LE.pack(2));
        } else if (state === 'removed') {
            this.subspace.set(ctx, encoders.tuple.pack([SUBSPACE_PID, pid]), encoders.int16LE.pack(3));
        } else {
            this.subspace.clear(ctx, encoders.tuple.pack([SUBSPACE_PID, pid]));
        }
    }

    async allocatePeerId(ctx: Context) {
        while (true) {
            const res = await inTx(withoutTransaction(ctx), async (c) => {
                const latest = ((await Store.Sequence.findById(ctx, 'conference-peer-id')))?.value || 0;
                const allocated = await this.allocator.allocate(c);
                if (allocated <= latest) {
                    return null;
                }
                return allocated;
            });
            if (res !== null) {
                return res;
            }
        }
    }
}