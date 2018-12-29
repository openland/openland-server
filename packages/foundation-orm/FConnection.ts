import * as fdb from 'foundationdb';
import { FContext, FGlobalContext } from './FContext';
import * as fs from 'fs';
import { FNodeRegistrator } from './utils/FNodeRegistrator';
import { RandomIDFactory } from 'openland-security/RandomIDFactory';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { FPubsub } from './FPubsub';
import { DirectoryAllocator } from './utils/DirectoryAllocator';
import { FDirectory } from './FDirectory';
import { FDiagnostics } from './FDiagnostics';

export class FConnection {
    static readonly globalContext: FContext = new FGlobalContext();
    readonly fdb: fdb.Database<NativeValue, any>;
    readonly pubsub: FPubsub;
    readonly diagnostics: FDiagnostics;
    private readonly directoryAllocator: DirectoryAllocator;
    private readonly nodeRegistrator: FNodeRegistrator;
    private randomFactory: RandomIDFactory | null = null;
    private test?: boolean;
    private testNextId = 0;

    static create() {
        let db: fdb.Database;
        fdb.setAPIVersion(510);
        let dcId = process.env.FOUNDATION_DC_ID ? process.env.FOUNDATION_DC_ID : undefined;
        if (process.env.FOUNDATION_DB) {
            fs.writeFileSync('foundation.clusterfile', process.env.FOUNDATION_DB);
            db = fdb.openSync('foundation.clusterfile', { datacenter_id: dcId });
        } else {
            db = fdb.openSync(undefined, { datacenter_id: dcId });
        }
        return db.withValueEncoding(fdb.encoders.json) as fdb.Database<NativeValue, any>;
    }

    constructor(connection: fdb.Database<NativeValue, any>, pubsub: FPubsub, test?: boolean) {
        this.fdb = connection;
        this.pubsub = pubsub;
        this.nodeRegistrator = new FNodeRegistrator(this);
        this.test = test;
        this.directoryAllocator = new DirectoryAllocator(this);
        this.diagnostics = new FDiagnostics(this);
    }

    getDirectory(key: (string | number | boolean)[]) {
        return new FDirectory(this, this.directoryAllocator, key);
    }

    async findAllDirectories() {
        return await this.directoryAllocator.findAllDirectories();
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
}