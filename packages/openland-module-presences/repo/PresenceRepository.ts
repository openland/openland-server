import { Subspace, encoders } from '@openland/foundationdb';
import { Context } from '@openland/context';

const SUBSPACE_LAST_SEEN = 0;
const SUBSPACE_LAST_SEEN_TIMEOUT = 2;
const SUBSPACE_ACTIVE = 1;
const SUBSPACE_ACTIVE_TIMEOUT = 3;
const SUBSPACE_TOKEN = 4;
const SUBSPACE_TOKEN_LATEST = 5;
const ZERO = Buffer.from([]);

export type PresenceType = { lastSeen: { date: number, timeout: number } | null, lastActive: { date: number, timeout: number } | null };

export class PresenceRepository {

    readonly directory: Subspace;

    constructor(directory: Subspace) {
        this.directory = directory;
    }

    async setOnline(ctx: Context, uid: number, tid: string, now: number, expires: number, active: boolean) {

        //
        // Convert to seconds
        // NOTE: We use seconds instead of common milliseconds to being able use int32LE encoder that
        //       is very useful as atomic counter
        //
        let clampedLastSeen = Math.floor(now / 1000);
        let clampedExpires = Math.floor(expires / 1000);

        //
        // Update last seen
        // NODE: Last seen can only be advanced and can't be decreased
        //
        if (active) {
            this.directory.max(ctx, encoders.tuple.pack([uid, SUBSPACE_ACTIVE]), encoders.int32LE.pack(clampedLastSeen));
        }
        this.directory.max(ctx, encoders.tuple.pack([uid, SUBSPACE_LAST_SEEN]), encoders.int32LE.pack(clampedLastSeen));

        //
        // Persist token information
        // 
        let ex = await this.directory.get(ctx, encoders.tuple.pack([uid, SUBSPACE_TOKEN, tid]));
        if (ex) {
            let token = encoders.json.unpack(ex);
            let existingExpires = token.expires as number;
            this.directory.clear(ctx, encoders.tuple.pack([uid, SUBSPACE_TOKEN_LATEST, existingExpires, tid]));
        }
        this.directory.set(ctx, encoders.tuple.pack([uid, SUBSPACE_TOKEN, tid]), encoders.json.pack({ expires: clampedExpires, lastSeen: clampedLastSeen, active }));
        this.directory.set(ctx, encoders.tuple.pack([uid, SUBSPACE_TOKEN_LATEST, clampedExpires, tid]), ZERO);

        // Recalculate timeouts
        await this.recalculateTimeouts(ctx, uid, now);
    }

    async setOffline(ctx: Context, uid: number, tid: string, now: number) {
        await this.setOnline(ctx, uid, tid, now, now, false);
    }

    private async recalculateTimeouts(ctx: Context, uid: number, now: number) {

        // Resolve actual timeout
        let activeTimeout: number | null = null;
        let lastSeenTimeout: number | null = null;
        let tokens = await this.getRecentTokens(ctx, uid, now);
        for (let tid of tokens) {
            let ex = await this.directory.get(ctx, encoders.tuple.pack([uid, SUBSPACE_TOKEN, tid]));
            if (ex) {
                let token = encoders.json.unpack(ex);
                let active = token.active as boolean;
                let expires = token.expires as number;
                if (active) {
                    if (activeTimeout === null || activeTimeout < expires) {
                        activeTimeout = expires;
                    }
                }
                if (lastSeenTimeout === null || lastSeenTimeout < expires) {
                    lastSeenTimeout = expires;
                }
            }
        }

        // Update timeouts
        if (activeTimeout === null) {
            this.directory.clear(ctx, encoders.tuple.pack([uid, SUBSPACE_ACTIVE_TIMEOUT]));
        } else {
            this.directory.set(ctx, encoders.tuple.pack([uid, SUBSPACE_ACTIVE_TIMEOUT]), encoders.int32LE.pack(activeTimeout));
        }
        if (lastSeenTimeout === null) {
            this.directory.clear(ctx, encoders.tuple.pack([uid, SUBSPACE_LAST_SEEN_TIMEOUT]));
        } else {
            this.directory.set(ctx, encoders.tuple.pack([uid, SUBSPACE_LAST_SEEN_TIMEOUT]), encoders.int32LE.pack(lastSeenTimeout));
        }
    }

    async getRecentTokens(ctx: Context, uid: number, now: number) {
        let nowClamped = Math.floor(now / 1000);
        let tokens = await this.directory.range(ctx, encoders.tuple.pack([uid, SUBSPACE_TOKEN_LATEST]), { after: encoders.tuple.pack([uid, SUBSPACE_TOKEN_LATEST, nowClamped]) });
        let res: string[] = [];
        for (let t of tokens) {
            let tuple = encoders.tuple.unpack(t.key);
            let tid = tuple[tuple.length - 1] as string;
            res.push(tid);
        }
        return res;
    }

    async getTokenLastSeen(ctx: Context, uid: number, tid: string) {
        let ex = await this.directory.get(ctx, encoders.tuple.pack([uid, SUBSPACE_TOKEN, tid]));
        if (!ex) {
            return null;
        }
        let token = encoders.json.unpack(ex);
        return { lastSeen: (token.lastSeen as number) * 1000, expires: (token.expires as number) * 1000 };
    }

    async getOnline(ctx: Context, uid: number): Promise<PresenceType> {
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