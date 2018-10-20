// tslint:disable:no-floating-promises
import * as fdb from 'foundationdb';
import { inTx } from './inTx';
import { FTransaction } from './FTransaction';

describe('inTx', () => {
    // Database Init
    let db: fdb.Database<fdb.TupleItem[], any>;
    beforeAll(async () => {
        fdb.setAPIVersion(510);
        db = fdb.openSync()
            .at('_tests_intx')
            .withKeyEncoding(fdb.encoders.tuple)
            .withValueEncoding(fdb.encoders.json);
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