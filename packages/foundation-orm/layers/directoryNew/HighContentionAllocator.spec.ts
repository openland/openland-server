import { HighContentionAllocator } from './HighContentionAllocator';
import { FKeyEncoding } from './../../utils/FKeyEncoding';
import { FConnection } from './../../FConnection';
import { createNamedContext } from '@openland/context';
import { NoOpBus } from 'foundation-orm/tests/NoOpBus';
import { inTx } from 'foundation-orm/inTx';

describe('HighContentionAllocator', () => {

    // Database Init
    let connection: FConnection;
    beforeAll(async () => {
        let db = FConnection.create()
            .at(FKeyEncoding.encodeKey(['_tests_allocator_new']));
        await db.clearRange(FKeyEncoding.encodeKey([]));
        connection = new FConnection(db, NoOpBus);
        await connection.ready(createNamedContext('test'));
    });

    it('should allocate', async () => {
        let allocator = new HighContentionAllocator(Buffer.of(0));
        let promises: Promise<number>[] = [];
        for (let i = 0; i < 1000; i++) {
            promises.push(inTx(createNamedContext('test'), async (ctx) => {
                return await allocator.allocate(ctx, connection);
            }));
        }
        let res = await Promise.all(promises);
        let set = new Set(res);
        expect(set.size).toBe(res.length);
    });
});