import { createNamedContext } from '@openland/context';
import { Database, inTx } from '@openland/foundationdb';
import { CachedSubspace } from './CachedSubspace';

let root = createNamedContext('test');

describe('CachedSubspace', () => {
    let repo: CachedSubspace<string>;
    beforeAll(async () => {
        let db = await Database.openTest({ name: 'counters-directory', layers: [] });
        repo = new CachedSubspace<string>(db.allKeys, (src) => Buffer.from(src, 'utf8'), (src) => src.toString('utf8'));
    });

    it('should persist records', async () => {
        await inTx(root, async (ctx) => {
            repo.write(ctx, [1], 'value-1');
            repo.write(ctx, [2], 'value-2');
            repo.write(ctx, [3], 'value-3');
        });
        await inTx(root, async (ctx) => {
            expect((await repo.read(ctx, [1]))).toMatch('value-1');
            expect((await repo.read(ctx, [2]))).toMatch('value-2');
            expect((await repo.read(ctx, [3]))).toMatch('value-3');
        });

        await inTx(root, async (ctx) => {
            expect(await repo.read(ctx, [4])).toBeNull();
            repo.write(ctx, [4], 'value-4');
        });
        await inTx(root, async (ctx) => {
            expect((await repo.read(ctx, [4]))).toMatch('value-4');
        });
    });
});