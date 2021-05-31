import { randomKey } from 'openland-utils/random';
import { createNamedContext } from '@openland/context';
import { testEnvironmentEnd, testEnvironmentStart } from 'openland-modules/testEnvironment';
import { inTx, getTransaction } from '@openland/foundationdb';
import { ScalableShardRepository, PeerState } from './ScalableShardRepository';
import { Store } from 'openland-module-db/FDB';

const parent = createNamedContext('test');

describe('ScalableShardRepository', () => {

    it('should allocate shard', async () => {
        const repo = new ScalableShardRepository();
        const session = randomKey();
        const workers: string[] = ['worker-1', 'worker-2'];
        let state = await inTx(parent, async (ctx) => {
            let toAdd: PeerState[] = [];
            for (let i = 0; i < 100; i++) {
                toAdd.push({ pid: i, consumer: true, producer: true });
            }
            await repo.updateSharding(ctx, 1, session,
                workers,
                [],
                toAdd,
                []
            );
            let res = await repo.getShardingState(ctx, 1, session);
            let size = await getTransaction(ctx).rawWriteTransaction(Store.storage.db).getApproximateSize();
            return { size, res };
        });
        expect(state.res.mode).not.toBeNull();
        expect(state.res.peers.length).toBe(200);
    });

    beforeAll(async () => {
        await testEnvironmentStart('calls-scalable-shard');
    });
    afterAll(async () => {
        await testEnvironmentEnd();
    });
});