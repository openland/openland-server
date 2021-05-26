import { createNamedContext } from '@openland/context';
import { Database, inTx } from '@openland/foundationdb';
import { WorkQueueRepository } from './WorkQueueRepository';

describe('WorkQueueRepository', () => {
    it('should schedule work', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest();
        let repo = await WorkQueueRepository.open(root, db);

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

    it('should work with batched jobs', async () => {
        let root = createNamedContext('test');
        let db = await Database.openTest();
        let repo = await WorkQueueRepository.open(root, db);

        // Initial tasks
        await inTx(root, async (ctx) => {
            expect(await repo.writePendingTask(ctx, 'task', { task: 1 })).toBe(true);
            expect(await repo.writePendingTask(ctx, 'task', { task: 2 })).toBe(false);
            expect(await repo.writePendingTask(ctx, 'task', { task: 3 })).toBe(false);
            expect(await repo.writePendingTask(ctx, 'task', { task: 4 })).toBe(false);
        });

        // Simple in transaction commits
        await inTx(root, async (ctx) => {
            let res = await repo.readPendingTasks(ctx, 'task');
            expect(res).not.toBeNull();
            expect(res!.tasks.length).toBe(4);
            res = await repo.readPendingTasks(ctx, 'task');
            expect(res).not.toBeNull();
            expect(res!.tasks.length).toBe(4);
            await repo.commitTasks(ctx, 'task', res!.counter, res!.offset);
            res = await repo.readPendingTasks(ctx, 'task');
            expect(res).toBeNull();
        });

        // Re-add tasks
        await inTx(root, async (ctx) => {
            expect(await repo.writePendingTask(ctx, 'task', { task: 1 })).toBe(true);
            expect(await repo.writePendingTask(ctx, 'task', { task: 2 })).toBe(false);
            expect(await repo.writePendingTask(ctx, 'task', { task: 3 })).toBe(false);
            expect(await repo.writePendingTask(ctx, 'task', { task: 4 })).toBe(false);
        });

        // Fetch pending
        let pending = await inTx(root, async (ctx) => {
            return await repo.readPendingTasks(ctx, 'task');
        });
        expect(pending!.tasks.length).toBe(4);
        await inTx(root, async (ctx) => {
            expect(await repo.writePendingTask(ctx, 'task', { task: 5 })).toBe(false);
        });

        // Should not commit
        await inTx(root, async (ctx) => {
            expect(await repo.commitTasks(ctx, 'task', pending!.counter, pending!.offset)).toBe(false);
        });

        // Should read only pending
        pending = await inTx(root, async (ctx) => {
            return await repo.readPendingTasks(ctx, 'task');
        });
        expect(pending!.tasks.length).toBe(1);

        // Should commit
        await inTx(root, async (ctx) => {
            expect(await repo.commitTasks(ctx, 'task', pending!.counter, pending!.offset)).toBe(true);
        });
    });
});