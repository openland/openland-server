import { createNamedContext } from '@openland/context';
import { ScalableRepository } from './ScalableRepository';
import { testEnvironmentEnd, testEnvironmentStart } from 'openland-modules/testEnvironment';
import { inTx } from '@openland/foundationdb';

const parent = createNamedContext('test');

describe('ScalableRepository', () => {

    it('should pass benchmark', async () => {
        const repo = new ScalableRepository();
        let total = 0;
        let p: Promise<void>[] = [];
        for (let i = 0; i < 15000; i++) {
            p.push(inTx(parent, async (ctx) => {
                total++;
                (await repo.addPeer(ctx, 3, i, 'speaker'));
            }));
        }
        await Promise.all(p);
        expect(total).toBe(15000);
    });

    it('should register without unnecessary retries', async () => {
        const repo = new ScalableRepository();
        let total = 0;
        let totalAdded = 0;
        let p: Promise<{ wasAdded: boolean }>[] = [];
        for (let i = 0; i < 100; i++) {
            p.push(inTx(parent, async (ctx) => {
                total++;
                return (await repo.addPeer(ctx, 1, i, 'speaker'));
            }));
        }
        let res = await Promise.all(p);
        for (let r of res) {
            if (r.wasAdded) {
                totalAdded++;
            }
        }
        expect(total).toBe(100); // All transactions must not retry
        expect(totalAdded).toBe(100); // All must be added

        // Try again
        total = 0;
        totalAdded = 0;
        p = [];
        for (let i = 0; i < 100; i++) {
            p.push(inTx(parent, async (ctx) => {
                total++;
                return (await repo.addPeer(ctx, 1, i + 100, 'speaker'));
            }));
        }
        res = await Promise.all(p);
        for (let r of res) {
            if (r.wasAdded) {
                totalAdded++;
            }
        }
        expect(total).toBe(100); // All transactions must not retry
        expect(totalAdded).toBe(100); // All must be added
    });

    it('should unregister without unnecessary retries', async () => {
        const repo = new ScalableRepository();

        // Register default
        await inTx(parent, async (ctx) => {
            for (let i = 0; i < 100; i++) {
                await repo.addPeer(ctx, 2, i, 'speaker');
            }
        });

        // Trying unregister
        let total = 0;
        let p: Promise<void>[] = [];
        for (let i = 0; i < 100; i++) {
            p.push(inTx(parent, async (ctx) => {
                total++;
                await repo.removePeer(ctx, 2, i, 'speaker');
            }));
        }
        await Promise.all(p);
        expect(total).toBe(100); // All transactions must not retry
    });

    it('should manage shards', async () => {
        const repo = new ScalableRepository();
        await inTx(parent, async (ctx) => {
            for (let i = 0; i < 1000; i++) {
                repo.addShard(ctx, 100, 'sss', 'sss-' + i, 'producers');
            }
        });

        let shards = await inTx(parent, async (ctx) => {
            return await repo.getShards(ctx, 100, 'sss');
        });
        expect(shards.length).toBe(1000);
    });

    beforeAll(async () => {
        await testEnvironmentStart('calls-scalable');
    });
    afterAll(async () => {
        await testEnvironmentEnd();
    });
});