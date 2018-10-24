import * as fdb from 'foundationdb';
import { FContext, FGlobalContext } from './FContext';
import { FTransaction } from './FTransaction';
import * as fs from 'fs';
import { FNodeRegistrator } from './utils/FNodeRegistrator';

export class FConnection {
    readonly fdb: fdb.Database<fdb.TupleItem[], any>;
    private readonly globalContext: FContext;
    private readonly nodeRegistrator: FNodeRegistrator;

    static create() {
        let db: fdb.Database;
        fdb.setAPIVersion(510);
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
        this.nodeRegistrator = new FNodeRegistrator(this);
    }

    get nodeId(): Promise<number> {
        return this.nodeRegistrator.getNodeId();
    }

    async nextRandomId(): Promise<string> {
        let nid = await this.nodeId;
        let timestamp = Date.now() - 1288834974657;
        return timestamp + '-' + nid + '-';
    }

    get currentContext(): FContext {
        let tx = FTransaction.context.value;
        if (tx) {
            return tx;
        }
        return this.globalContext;
    }
}