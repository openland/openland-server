import * as fdb from 'foundationdb';
import * as fs from 'fs';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { FSubspace } from './FSubspace';
import { FGlobalSpace } from './subspace/FGlobalSpace';

export class FConnection {
    readonly fdb: fdb.Database<NativeValue, Buffer>;
    readonly allKeys: FSubspace;

    static create() {
        let db: fdb.Database;
        fdb.setAPIVersion(510);
        let dcId = process.env.FOUNDATION_DC_ID ? process.env.FOUNDATION_DC_ID : undefined;
        if (process.env.FOUNDATION_DB) {
            fs.writeFileSync('foundation.clusterfile', process.env.FOUNDATION_DB);
            db = fdb.openSync('foundation.clusterfile', dcId ? { datacenter_id: dcId } : undefined);
        } else {
            db = fdb.openSync(undefined, dcId ? { datacenter_id: dcId } : undefined);
        }
        return db as fdb.Database<NativeValue, Buffer>;
    }

    constructor(connection: fdb.Database<NativeValue, Buffer>) {
        this.fdb = connection;
        this.allKeys = new FGlobalSpace(this);
    }
}