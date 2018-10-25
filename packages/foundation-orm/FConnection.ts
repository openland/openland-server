import * as fdb from 'foundationdb';
import { FContext, FGlobalContext } from './FContext';
import { FTransaction } from './FTransaction';
import * as fs from 'fs';
import { FNodeRegistrator } from './utils/FNodeRegistrator';
import { RandomIDFactory } from 'openland-security/RandomIDFactory';
import { NativeValue } from 'foundationdb/dist/lib/native';

export class FConnection {
    readonly fdb: fdb.Database<NativeValue, any>;
    private readonly globalContext: FContext;
    private readonly nodeRegistrator: FNodeRegistrator;
    private randomFactory: RandomIDFactory | null = null;
    private test?: boolean;
    private testNextId = 0;

    static create() {
        let db: fdb.Database;
        fdb.setAPIVersion(510);
        if (process.env.FOUNDATION_DB) {
            fs.writeFileSync('foundation.clusterfile', process.env.FOUNDATION_DB);
            db = fdb.openSync('foundation.clusterfile');
        } else {
            db = fdb.openSync();
        }
        return db.withValueEncoding(fdb.encoders.json) as fdb.Database<NativeValue, any>;
    }

    constructor(connection: fdb.Database<NativeValue, any>, test?: boolean) {
        this.fdb = connection;
        this.globalContext = new FGlobalContext();
        this.nodeRegistrator = new FNodeRegistrator(this);
        this.test = test;
    }

    get nodeId() {
        return this.nodeRegistrator.getNodeId();
    }

    async nextRandomId(): Promise<string> {
        if (this.test) {
            return (++this.testNextId).toString();
        }
        let nid = await this.nodeId;
        if (this.randomFactory === null) {
            this.randomFactory = new RandomIDFactory(nid);
        }
        return await this.randomFactory.next();
    }

    get currentContext(): FContext {
        let tx = FTransaction.context.value;
        if (tx) {
            return tx;
        }
        return this.globalContext;
    }
}