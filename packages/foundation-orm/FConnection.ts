import * as fdb from 'foundationdb';
import * as fs from 'fs';
import { RandomIDFactory } from 'openland-security/RandomIDFactory';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { FPubsub } from './FPubsub';
import { DirectoryAllocator } from './utils/DirectoryAllocator';
import { FDirectory } from './FDirectory';
import { FDiagnostics } from './FDiagnostics';
import { FSubspace } from './FSubspace';
import { FGlobalSpace } from './subspace/FGlobalSpace';
import { FDirectoryLayer } from './layers/FDirectoryLayer';
import { FNodeIDLayer } from './layers/FNodeIDLayer';

export class FConnection {
    readonly fdb: fdb.Database<NativeValue, Buffer>;
    readonly pubsub: FPubsub;
    readonly diagnostics: FDiagnostics;
    readonly keySpace: FSubspace;
    readonly directoryLayer: FDirectoryLayer;
    readonly nodeIdLayer: FNodeIDLayer;
    private readonly directoryAllocator: DirectoryAllocator;
    private randomFactory: RandomIDFactory | null = null;
    private test?: boolean;
    private testNextId = 0;

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

    constructor(connection: fdb.Database<NativeValue, Buffer>, pubsub: FPubsub, test?: boolean) {
        this.fdb = connection;
        this.pubsub = pubsub;
        this.test = test;
        this.directoryAllocator = new DirectoryAllocator(this);
        this.diagnostics = new FDiagnostics(this);
        this.keySpace = new FGlobalSpace(this);
        this.directoryLayer = new FDirectoryLayer(this);
        this.nodeIdLayer = new FNodeIDLayer(this);
    }

    async ready() {
        await this.directoryLayer.ready();
        await this.nodeIdLayer.ready();
    }

    getDirectory(key: (string | number | boolean)[]) {
        return new FDirectory(this, this.directoryAllocator, key);
    }

    async findAllDirectories() {
        return await this.directoryAllocator.findAllDirectories();
    }

    nextRandomId(): string {
        if (this.test) {
            return (++this.testNextId).toString();
        }
        if (this.randomFactory === null) {
            let nid = this.nodeIdLayer.nodeId;
            this.randomFactory = new RandomIDFactory(nid);
        }
        return this.randomFactory.next();
    }
}