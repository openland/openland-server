// tslint:disable:no-floating-promises
import * as fdb from 'foundationdb';
import { FConnection } from '../FConnection';
import { withLogDisabled } from 'openland-log/withLogDisabled';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { NoOpBus } from './NoOpBus';

describe('Random', () => {

    // Database Init
    let db: fdb.Database<NativeValue, any>;
    beforeAll(async () => {
        db = FConnection.create()
            .at(FKeyEncoding.encodeKey(['_tests_random']));
        await db.clearRange(FKeyEncoding.encodeKey([]));
    });

    it('should pick node id successfully', async () => {
        await withLogDisabled(async () => {
            let connections: FConnection[] = [];
            for (let i = 0; i < 32; i++) {
                connections.push(new FConnection(db, NoOpBus));
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