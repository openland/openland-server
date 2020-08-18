import { PresenceRepository } from './PresenceRepository';
import { Database, inTx } from '@openland/foundationdb';
import { createNamedContext } from '@openland/context';

describe('PresenceRepository', () => {
    it('should persist online status', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'presences', layers: [] });
        let repo = new PresenceRepository(db.allKeys);

        // Initial
        let online = await inTx(root, async (ctx) => {
            return await repo.getOnline(ctx, 1);
        });
        expect(online.lastActive).toBeNull();
        expect(online.lastSeen).toBeNull();

        let now = 1000;

        // Initial
        let expires = now + 5000;
        await inTx(root, async (ctx) => {
            await repo.setOnline(ctx, 1, 'tid-1', now, expires, true);
        });

        // The one that expires earlier
        let expires2 = now + 4000;
        await inTx(root, async (ctx) => {
            await repo.setOnline(ctx, 1, 'tid-1', now, expires2, true);
        });

        // Check state
        online = await inTx(root, async (ctx) => {
            return await repo.getOnline(ctx, 1);
        });
        expect(online.lastActive!.date).toBe(now);
        expect(online.lastActive!.timeout).toBe(expires2);
        expect(online.lastSeen!.date).toBe(now);
        expect(online.lastSeen!.timeout).toBe(expires2);

        // Extension
        let expires3 = now + 6000;
        await inTx(root, async (ctx) => {
            await repo.setOnline(ctx, 1, 'tid-1', now, expires3, false);
        });
        online = await inTx(root, async (ctx) => {
            return await repo.getOnline(ctx, 1);
        });
        expect(online.lastActive!.date).toBe(now);
        expect(online.lastActive!.timeout).toBe(now); // Since active status already expired
        expect(online.lastSeen!.date).toBe(now);
        expect(online.lastSeen!.timeout).toBe(expires3);

        let tokens = await inTx(root, async (ctx) => {
            return await repo.getRecentTokens(ctx, 1, now);
        });
        expect(tokens).toMatchObject(['tid-1']);

        tokens = await inTx(root, async (ctx) => {
            return await repo.getRecentTokens(ctx, 1, now + 100000);
        });
        expect(tokens).toMatchObject([]);

        // Go offline
        await inTx(root, async (ctx) => {
            await repo.setOffline(ctx, 1, 'tid-1', now);
        });
        online = await inTx(root, async (ctx) => {
            return await repo.getOnline(ctx, 1);
        });
        expect(online.lastActive!.date).toBe(now);
        expect(online.lastActive!.timeout).toBe(now);
        expect(online.lastSeen!.date).toBe(now);
        expect(online.lastSeen!.timeout).toBe(now);
    });
});