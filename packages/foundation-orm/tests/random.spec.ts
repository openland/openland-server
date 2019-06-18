import { FNodeIDLayer } from './../layers/FNodeIDLayer';
// tslint:disable:no-floating-promises
import * as fdb from 'foundationdb';
import { FConnection } from '../FConnection';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';

describe('Random', () => {

    // Database Init
    let db: fdb.Database<NativeValue, any>;
    beforeAll(async () => {
        db = FConnection.create()
            .at(FKeyEncoding.encodeKey(['_tests_random']));
        await db.clearRange(FKeyEncoding.encodeKey([]));
    });

    it('should pick node id successfully', async () => {
        let connections: FNodeIDLayer[] = [];
        for (let i = 0; i < 32; i++) {
            connections.push(new FNodeIDLayer(new FConnection(db)));
        }
        for (let i = 0; i < 32; i++) {
            await connections[i].ready();
        }
        let idsv: number[] = [];
        for (let i = 0; i < connections.length; i++) {
            idsv.push(connections[i].nodeId);
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