// tslint:disable:no-floating-promises
import { FConnection } from '../FConnection';
import { Database } from '@openland/foundationdb';
import { FNodeIDLayer } from './../layers/FNodeIDLayer';

describe('Random', () => {

    // Database Init
    let db: Database;
    beforeAll(async () => {
        db = await Database.openTest();
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