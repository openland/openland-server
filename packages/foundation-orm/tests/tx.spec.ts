// tslint:disable:no-floating-promises
import * as fdb from 'foundationdb';
import { inTx } from '../inTx';
import { FTransaction } from '../FTransaction';
import { FConnection } from '../FConnection';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { createEmptyContext } from 'openland-utils/Context';

describe('inTx', () => {

    // Database Init
    let db: fdb.Database<NativeValue, any>;
    beforeAll(async () => {
        db = FConnection.create()
            .at(FKeyEncoding.encodeKey(['_tests_versioned']));
        await db.clearRange(FKeyEncoding.encodeKey([]));
    });

    it('should pass transaction information', async () => {
        let root = createEmptyContext();
        // With await
        expect(FTransaction.context.value).toBeUndefined();
        await inTx(root, async (ctx) => {
            expect(FTransaction.context.value).not.toBeUndefined();
        });
        expect(FTransaction.context.value).toBeUndefined();

        // Without await
        expect(FTransaction.context.value).toBeUndefined();
        inTx(root, async (ctx) => {
            expect(FTransaction.context.value).not.toBeUndefined();
        });
        expect(FTransaction.context.value).toBeUndefined();
    });
});