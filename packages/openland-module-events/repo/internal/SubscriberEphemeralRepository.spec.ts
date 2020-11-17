import { createNamedContext } from '@openland/context';
import { Database, inTx, createVersionstampRef } from '@openland/foundationdb';
import { SubscriberEphemeralRepository } from './SubscriberEphemeralRepository';
describe('SubscriberEphemeralRepository', () => {
    it('should register ephemeral changes', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest({ name: 'event-subscriber-root', layers: [] });
        let repo = new SubscriberEphemeralRepository(db.allKeys);
        let subs = Buffer.from([0]);
        let feed = Buffer.from([1]);

        let r = (await inTx(root, async (ctx) => {
            let start = createVersionstampRef(ctx);
            let ref = createVersionstampRef(ctx);
            await repo.writeEphemeralChanged(ctx, subs, feed, ref);
            return { ref, start };
        }));

        let r2 = await inTx(root, async (ctx) => {
            return await repo.getUpdatedFeeds(ctx, subs, r.start.resolved.value);
        });
        expect(r2).toMatchObject([{ feed, vt: r.ref.resolved.value }]);
    });
});