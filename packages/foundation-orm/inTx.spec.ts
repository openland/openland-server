// tslint:disable:no-floating-promises
import * as fdb from 'foundationdb';
import { inTx } from './inTx';
import { FTransaction } from './FTransaction';
import { FConnection } from './FConnection';

describe('inTx', () => {
    // Database Init
    let db: fdb.Database<fdb.TupleItem[], any>;
    beforeAll(async () => {
        db = FConnection.create()
            .at(['_tests_tx']);
        await db.clearRange([]);
    });

    it('should pass transaction information', async () => {
        // With await
        expect(FTransaction.context.value).toBeUndefined();
        await inTx(async () => {
            expect(FTransaction.context.value).not.toBeUndefined();
        });
        expect(FTransaction.context.value).toBeUndefined();

        // Without await
        expect(FTransaction.context.value).toBeUndefined();
        inTx(async () => {
            expect(FTransaction.context.value).not.toBeUndefined();
        });
        expect(FTransaction.context.value).toBeUndefined();
    });
});