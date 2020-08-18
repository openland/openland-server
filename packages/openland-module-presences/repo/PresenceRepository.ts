import { Subspace, encoders } from '@openland/foundationdb';
import { Context } from '@openland/context';

const SUBSPACE_LAST_SEEN = 0;
const SUBSPACE_ACTIVE = 1;

export class PresenceRepository {

    readonly directory: Subspace;

    constructor(directory: Subspace) {
        this.directory = directory;
    }

    setOnline(ctx: Context, uid: number, expires: number, active: boolean) {

        // Convert to seconds
        let clampedExpires = Math.floor(expires / 1000);

        // Update user online
        if (active) {
            this.directory.max(ctx, encoders.tuple.pack([uid, SUBSPACE_ACTIVE]), encoders.int32LE.pack(clampedExpires));
        }
        this.directory.max(ctx, encoders.tuple.pack([uid, SUBSPACE_LAST_SEEN]), encoders.int32LE.pack(clampedExpires));
    }

    async getOnline(ctx: Context, uid: number) {
        let lastSeenPromise = this.directory.get(ctx, encoders.tuple.pack([uid, SUBSPACE_LAST_SEEN]));
        let lastActivePromise = this.directory.get(ctx, encoders.tuple.pack([uid, SUBSPACE_ACTIVE]));
        let lastSeenRaw = await lastSeenPromise;
        let lastActiveRaw = await lastActivePromise;
        let lastSeen: number | null = null;
        let lastActive: number | null = null;
        if (lastSeenRaw) {
            lastSeen = encoders.int32LE.unpack(lastSeenRaw) * 1000;
        }
        if (lastActiveRaw) {
            lastActive = encoders.int32LE.unpack(lastActiveRaw) * 1000;
        }
        return {
            lastSeen,
            lastActive
        };
    }
}