import { Subspace, encoders } from '@openland/foundationdb';
import { Context } from '@openland/context';

const SUBSPACE_LAST_SEEN = 0;
const SUBSPACE_LAST_SEEN_TIMEOUT = 2;
const SUBSPACE_ACTIVE = 1;
const SUBSPACE_ACTIVE_TIMEOUT = 3;

export class PresenceRepository {

    readonly directory: Subspace;

    constructor(directory: Subspace) {
        this.directory = directory;
    }

    async setOnline(ctx: Context, uid: number, lastSeen: number, expires: number, active: boolean) {

        // Convert to seconds
        let clampedLastSeen = Math.floor(lastSeen / 1000);
        let clampedExpires = Math.floor(expires / 1000);

        // Update user online
        if (active) {
            this.directory.max(ctx, encoders.tuple.pack([uid, SUBSPACE_ACTIVE]), encoders.int32LE.pack(clampedLastSeen));
            this.directory.max(ctx, encoders.tuple.pack([uid, SUBSPACE_ACTIVE_TIMEOUT]), encoders.int32LE.pack(clampedExpires));
        }
        this.directory.max(ctx, encoders.tuple.pack([uid, SUBSPACE_LAST_SEEN]), encoders.int32LE.pack(clampedLastSeen));
        this.directory.max(ctx, encoders.tuple.pack([uid, SUBSPACE_LAST_SEEN_TIMEOUT]), encoders.int32LE.pack(clampedExpires));
    }

    async getOnline(ctx: Context, uid: number) {
        let lastSeenPromise = this.directory.get(ctx, encoders.tuple.pack([uid, SUBSPACE_LAST_SEEN]));
        let lastSeenTimeoutPromise = this.directory.get(ctx, encoders.tuple.pack([uid, SUBSPACE_LAST_SEEN_TIMEOUT]));
        let lastActivePromise = this.directory.get(ctx, encoders.tuple.pack([uid, SUBSPACE_ACTIVE]));
        let lastActiveTimeoutPromise = this.directory.get(ctx, encoders.tuple.pack([uid, SUBSPACE_ACTIVE_TIMEOUT]));
        let lastSeenRaw = await lastSeenPromise;
        let lastSeenTimeoutRaw = await lastSeenTimeoutPromise;
        let lastActiveRaw = await lastActivePromise;
        let lastActiveTimeoutRaw = await lastActiveTimeoutPromise;

        let lastSeen: number | null = null;
        let lastSeenTimeout: number | null = null;
        let lastActive: number | null = null;
        let lastActiveTimeout: number | null = null;

        if (lastSeenRaw) {
            lastSeen = encoders.int32LE.unpack(lastSeenRaw) * 1000;
        }
        if (lastSeenTimeoutRaw) {
            lastSeenTimeout = encoders.int32LE.unpack(lastSeenTimeoutRaw) * 1000;
        }
        if (lastActiveRaw) {
            lastActive = encoders.int32LE.unpack(lastActiveRaw) * 1000;
        }
        if (lastActiveTimeoutRaw) {
            lastActiveTimeout = encoders.int32LE.unpack(lastActiveTimeoutRaw) * 1000;
        }
        if (lastSeen && (!lastSeenTimeout || lastSeenTimeout < lastSeen)) {
            lastSeenTimeout = lastSeen;
        }
        if (lastActive && (!lastActiveTimeout || lastActiveTimeout < lastActive)) {
            lastActiveTimeout = lastActive;
        }

        return {
            lastSeen: lastSeen ? { date: lastSeen, timeout: lastSeenTimeout! } : null,
            lastActive: lastActive ? { date: lastActive, timeout: lastActiveTimeout! } : null,
        };
    }
}