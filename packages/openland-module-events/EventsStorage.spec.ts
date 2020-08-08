import { EventsStorage } from './EventsStorage';
import { createNamedContext } from '@openland/context';
import { Database, inTx, getTransaction } from '@openland/foundationdb';

describe('EventsStorage', () => {
    it('posting should work', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest();
        let storage = await EventsStorage.open(db);

        let posted = await inTx(root, async (ctx) => {
            let res = await storage.post(ctx, { kind: 1, id: 2 });
            let vt = getTransaction(ctx).rawTransaction(db).getVersionstamp();
            return { res, vt };
        });
        let record = posted.res;
        let versionStamp = await posted.vt.promise;
        expect(record.length).toBe(16);

        let records = await inTx(root, async (ctx) => {
            return await storage.fetchLast(ctx, { kind: 1, id: 2 }, 11);
        });

        expect(records.length).toBe(1);
        expect(Buffer.compare(records[0].id, record)).toBe(0);
        expect(Buffer.compare(records[0].date.slice(0, 10), versionStamp)).toBe(0);
        expect(records[0].seq).toBe(1);
    });
});