import { createNamedContext } from '@openland/context';
import { Database, inTx } from '@openland/foundationdb';
import { WorkQueueRepository } from './WorkQueueRepository';

describe('WorkQueueRepository', () => {
    it('should schedule work', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest();
        let directory = await db.directories.createOrOpen(root, ['tasks']);
        let repo = new WorkQueueRepository(directory);

        // Create taks
        await inTx(root, async (ctx) => {
            for (let i = 0; i < 100; i++) {
                repo.pushWork(ctx, 10, { i }, 3);
            }
        });

        let now = Date.now();

        // Check acquire
        let acquired = await inTx(root, async (ctx) => {
            return await repo.acquireWork(ctx, 10, 100, Buffer.alloc(0), now + 5000);
        });
        expect(acquired.length).toBe(100);

        // Second acquire should be zero
        acquired = await inTx(root, async (ctx) => {
            return await repo.acquireWork(ctx, 10, 100, Buffer.alloc(0), now + 5000);
        });
        expect(acquired.length).toBe(0);

        // Reschedule tasks
        while (true) {
            let expired = await inTx(root, async (ctx) => {
                return await repo.rescheduleTasks(ctx, now + 10000);
            });
            if (!expired) {
                break;
            }
        }

        // Check acquire again
        acquired = await inTx(root, async (ctx) => {
            return await repo.acquireWork(ctx, 10, 100, Buffer.alloc(0), now + 5000);
        });
        expect(acquired.length).toBe(100);

        // Complete work
        await inTx(root, async (ctx) => {
            await repo.completeWork(ctx, acquired[0]);
        });

        // Refresh lock
        await inTx(root, async (ctx) => {
            await repo.refreshLock(ctx, acquired[1], Buffer.alloc(0), now + 15000);
        });

        // Reschedule tasks
        while (true) {
            let expired = await inTx(root, async (ctx) => {
                return await repo.rescheduleTasks(ctx, now + 10000);
            });
            if (!expired) {
                break;
            }
        }

        // Check acquire again
        acquired = await inTx(root, async (ctx) => {
            return await repo.acquireWork(ctx, 10, 100, Buffer.alloc(0), now + 5000);
        });
        expect(acquired.length).toBe(98);

        // Reschedule tasks
        while (true) {
            let expired = await inTx(root, async (ctx) => {
                return await repo.rescheduleTasks(ctx, now + 20000);
            });
            if (!expired) {
                break;
            }
        }

        // Check acquire again
        acquired = await inTx(root, async (ctx) => {
            return await repo.acquireWork(ctx, 10, 100, Buffer.alloc(0), now + 5000);
        });
        expect(acquired.length).toBe(1);
    });
});