import * as fdb from 'foundationdb';
import { FContext, FGlobalContext } from './FContext';
import { FTransaction } from './FTransaction';
import * as fs from 'fs';

try {
    fdb.setAPIVersion(510);
} catch (e) {
    // WTF?! Ignore it for now
}

export class FConnection {
    readonly fdb: fdb.Database<fdb.TupleItem[], any>;
    private readonly globalContext: FContext;

    static create() {
        let db: fdb.Database;
        if (process.env.FOUNDATION_DB) {
            fs.writeFileSync('foundation.clusterfile', process.env.FOUNDATION_DB);
            db = fdb.openSync('foundation.clusterfile');
        } else {
            db = fdb.openSync();
        }
        return db.withKeyEncoding(fdb.encoders.tuple)
            .withValueEncoding(fdb.encoders.json);
    }

    constructor(connection: fdb.Database<fdb.TupleItem[], any>) {
        this.fdb = connection;
        this.globalContext = new FGlobalContext();
    }

    get currentContext(): FContext {
        let tx = FTransaction.context.value;
        if (tx) {
            return tx;
        }
        return this.globalContext;
    }
}