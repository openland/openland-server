import { createNamedContext } from "@openland/context";
import { Database, inTx } from "@openland/foundationdb";
import { CounterSubscribersDirectory } from "./CounterSubscribersDirectory";
let root = createNamedContext('test');

describe('CounterSubscribersDirectory', () => {
    let repo: CounterSubscribersDirectory;
    beforeAll(async () => {
        let db = await Database.openTest({ name: 'counters-subscribers-directory', layers: [] });
        repo = new CounterSubscribersDirectory(db.allKeys);
    });

    it('should subscribe and unsubscribe', async () => {
        await inTx(root, async (ctx) => {
            await repo.subscribe(ctx, { uid: 1, cid: 1, seq: 1, counter: 2, mentions: 1, muted: true });

            expect(await repo.getCounter(ctx, 1, false, 'all')).toBe(2);
            expect(await repo.getCounter(ctx, 1, false, 'all-mentions')).toBe(1);
            expect(await repo.getCounter(ctx, 1, false, 'distinct')).toBe(1);
            expect(await repo.getCounter(ctx, 1, false, 'distinct-mentions')).toBe(1);

            expect(await repo.getCounter(ctx, 1, true, 'all')).toBe(0);
            expect(await repo.getCounter(ctx, 1, true, 'all-mentions')).toBe(0);
            expect(await repo.getCounter(ctx, 1, true, 'distinct')).toBe(0);
            expect(await repo.getCounter(ctx, 1, true, 'distinct-mentions')).toBe(0);

            await repo.subscribe(ctx, { uid: 1, cid: 2, seq: 1, counter: 2, mentions: 1, muted: false });

            expect(await repo.getCounter(ctx, 1, false, 'all')).toBe(4);
            expect(await repo.getCounter(ctx, 1, false, 'all-mentions')).toBe(2);
            expect(await repo.getCounter(ctx, 1, false, 'distinct')).toBe(2);
            expect(await repo.getCounter(ctx, 1, false, 'distinct-mentions')).toBe(2);

            expect(await repo.getCounter(ctx, 1, true, 'all')).toBe(2);
            expect(await repo.getCounter(ctx, 1, true, 'all-mentions')).toBe(1);
            expect(await repo.getCounter(ctx, 1, true, 'distinct')).toBe(1);
            expect(await repo.getCounter(ctx, 1, true, 'distinct-mentions')).toBe(1);

            await repo.subscribe(ctx, { uid: 1, cid: 2, seq: 1, counter: 2, mentions: 1, muted: true });

            expect(await repo.getCounter(ctx, 1, false, 'all')).toBe(4);
            expect(await repo.getCounter(ctx, 1, false, 'all-mentions')).toBe(2);
            expect(await repo.getCounter(ctx, 1, false, 'distinct')).toBe(2);
            expect(await repo.getCounter(ctx, 1, false, 'distinct-mentions')).toBe(2);

            expect(await repo.getCounter(ctx, 1, true, 'all')).toBe(0);
            expect(await repo.getCounter(ctx, 1, true, 'all-mentions')).toBe(0);
            expect(await repo.getCounter(ctx, 1, true, 'distinct')).toBe(0);
            expect(await repo.getCounter(ctx, 1, true, 'distinct-mentions')).toBe(0);

            await repo.unsubscribe(ctx, { uid: 1, cid: 2 });

            expect(await repo.getCounter(ctx, 1, false, 'all')).toBe(2);
            expect(await repo.getCounter(ctx, 1, false, 'all-mentions')).toBe(1);
            expect(await repo.getCounter(ctx, 1, false, 'distinct')).toBe(1);
            expect(await repo.getCounter(ctx, 1, false, 'distinct-mentions')).toBe(1);

            expect(await repo.getCounter(ctx, 1, true, 'all')).toBe(0);
            expect(await repo.getCounter(ctx, 1, true, 'all-mentions')).toBe(0);
            expect(await repo.getCounter(ctx, 1, true, 'distinct')).toBe(0);
            expect(await repo.getCounter(ctx, 1, true, 'distinct-mentions')).toBe(0);
        });

    });
});