import * as fdb from 'foundationdb';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { FConnection } from 'foundation-orm/FConnection';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { NoOpBus } from 'foundation-orm/tests/NoOpBus';
import { inTx } from 'foundation-orm/inTx';
import { createEmptyContext } from 'openland-utils/Context';

describe('FOperationsGloba', () => {
    let db: fdb.Database<NativeValue, any>;
    let connection: FConnection;
    beforeAll(async () => {
        db = FConnection.create()
            .at(FKeyEncoding.encodeKey(['_tests_ops']));
        await db.clearRange(FKeyEncoding.encodeKey([]));
        connection = new FConnection(db, NoOpBus);
    });

    it('should do set and get', async () => {
        let ops = connection.keySpace;
        await inTx(createEmptyContext(), async (ctx) => {
            ops.set(ctx, Buffer.of(0, 1, 2, 3, 4), Buffer.of(5, 6, 7, 8, 9));
        });

        let ex = await ops.get(createEmptyContext(), Buffer.of(0, 1, 2, 3, 4));
        expect(ex).not.toBeNull();
        expect(Buffer.compare(ex!, Buffer.of(5, 6, 7, 8, 9))).toBe(0);
    });

    it('subspace must work', async () => {
        let ops = connection.keySpace;
        let sops = connection.keySpace.subspace(Buffer.of(1));
        await inTx(createEmptyContext(), async (ctx) => {
            ops.set(ctx, Buffer.of(1, 2, 3, 4), Buffer.of(5, 6, 7, 8));
        });
        let ex = await sops.get(createEmptyContext(), Buffer.of(2, 3, 4));
        expect(ex).not.toBeNull();
        expect(Buffer.compare(ex!, Buffer.of(5, 6, 7, 8))).toBe(0);

        await inTx(createEmptyContext(), async (ctx) => {
            sops.set(ctx, Buffer.of(2, 3, 4), Buffer.of(9, 10, 11, 12));
        });
        ex = await ops.get(createEmptyContext(), Buffer.of(1, 2, 3, 4));
        expect(ex).not.toBeNull();
        expect(Buffer.compare(ex!, Buffer.of(9, 10, 11, 12))).toBe(0);
    });
});