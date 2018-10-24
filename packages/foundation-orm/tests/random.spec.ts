// tslint:disable:no-floating-promises
import * as fdb from 'foundationdb';
import { FConnection } from '../FConnection';
import { withLogDisabled } from 'openland-log/withLogDisabled';

describe('Random', () => {
    // Database Init
    let db: fdb.Database<fdb.TupleItem[], any>;
    beforeAll(async () => {
        db = FConnection.create()
            .at(['_tests_random']);
        await db.clearRange([]);
    });

    it('should pick node id successfully', async () => {
        await withLogDisabled(async () => {
            let connections: FConnection[] = [];
            for (let i = 0; i < 512; i++) {
                connections.push(new FConnection(db));
            }
            let ids: Promise<number>[] = [];
            for (let i = 0; i < connections.length; i++) {
                ids.push(connections[i].nodeId);
            }
            let idsv: number[] = [];
            for (let i = 0; i < connections.length; i++) {
                idsv.push(await ids[i]);
            }
            for (let i = 0; i < connections.length; i++) {
                for (let j = 0; j < connections.length; j++) {
                    if (i !== j) {
                        expect(idsv[i]).not.toBe(idsv[j]);
                    }
                }
            }
        });
    });
});