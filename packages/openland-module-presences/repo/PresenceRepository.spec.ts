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

        let now = Math.floor(Date.now() / 1000) * 1000;

        // Initial
        let expires = now + 5000;
        await inTx(root, async (ctx) => {
            repo.setOnline(ctx, 1, expires, true);
        });

        // The one that expires earlier
        let expires2 = now + 4000;
        await inTx(root, async (ctx) => {
            repo.setOnline(ctx, 1, expires2, true);
        });

        // Check state
        online = await inTx(root, async (ctx) => {
            return await repo.getOnline(ctx, 1);
        });
        expect(online.lastActive).toBe(expires);
        expect(online.lastSeen).toBe(expires);

        // Extension
        let expires3 = now + 6000;
        await inTx(root, async (ctx) => {
            repo.setOnline(ctx, 1,  expires3, false);
        });
        online = await inTx(root, async (ctx) => {
            return await repo.getOnline(ctx, 1);
        });
        expect(online.lastActive).toBe(expires);
        expect(online.lastSeen).toBe(expires3);
    });
});