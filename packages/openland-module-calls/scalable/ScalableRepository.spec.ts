import { createNamedContext } from '@openland/context';
import { ScalableRepository } from './ScalableRepository';
import { testEnvironmentEnd, testEnvironmentStart } from 'openland-modules/testEnvironment';
import { inTx } from '@openland/foundationdb';

const parent = createNamedContext('test');

describe('ScalableRepository', () => {

    it('should register without unnecessary retries', async () => {
        const repo = new ScalableRepository();
        let total = 0;
        let totalStarted = 0;
        let totalAdded = 0;
        let p: Promise<{ wasStarted: boolean, wasAdded: boolean }>[] = [];
        for (let i = 0; i < 100; i++) {
            p.push(inTx(parent, async (ctx) => {
                total++;
                return (await repo.addPeer(ctx, 1, i));
            }));
        }
        let res = await Promise.all(p);
        for (let r of res) {
            if (r.wasStarted) {
                totalStarted++;
            }
            if (r.wasAdded) {
                totalAdded++;
            }
        }
        expect(total).toBe(199); // All transactions except one must retry
        expect(totalStarted).toBe(1); // Only single transaction must retrun true
        expect(totalAdded).toBe(100); // All must be added

        // Try again
        total = 0;
        totalStarted = 0;
        totalAdded = 0;
        p = [];
        for (let i = 0; i < 100; i++) {
            p.push(inTx(parent, async (ctx) => {
                total++;
                return (await repo.addPeer(ctx, 1, i + 100));
            }));
        }
        res = await Promise.all(p);
        for (let r of res) {
            if (r.wasStarted) {
                totalStarted++;
            }
            if (r.wasAdded) {
                totalAdded++;
            }
        }
        expect(total).toBe(100); // All transactions must not retry
        expect(totalStarted).toBe(0); // Nothing must start
        expect(totalAdded).toBe(100); // All must be added
    });

    it('should unregister without unnecessary retries', async () => {
        const repo = new ScalableRepository();

        // Register default
        await inTx(parent, async (ctx) => {
            for (let i = 0; i < 100; i++) {
                await repo.addPeer(ctx, 2, i);
            }
        });

        // Trying unregister
        let total = 0;
        let p: Promise<void>[] = [];
        for (let i = 0; i < 100; i++) {
            p.push(inTx(parent, async (ctx) => {
                total++;
                await repo.removePeer(ctx, 2, i);
            }));
        }
        await Promise.all(p);
        expect(total).toBe(100);
    });

    beforeAll(async () => {
        await testEnvironmentStart('calls-scalable');
    });
    afterAll(async () => {
        await testEnvironmentEnd();
    });
});