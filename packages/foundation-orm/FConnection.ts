import * as fdb from 'foundationdb';
import * as fs from 'fs';
import { RandomIDFactory } from 'openland-security/RandomIDFactory';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { FPubsub } from './FPubsub';
import { FDiagnostics } from './FDiagnostics';
import { FSubspace } from './FSubspace';
import { FGlobalSpace } from './subspace/FGlobalSpace';
import { FNodeIDLayer } from './layers/FNodeIDLayer';
import { Context } from '@openland/context';

export class FConnection {
    readonly fdb: fdb.Database<NativeValue, Buffer>;
    readonly pubsub: FPubsub;
    readonly allKeys: FSubspace;
    readonly nodeIdLayer: FNodeIDLayer;
    readonly diagnostics: FDiagnostics;

    // Obsolete
    private test?: boolean;
    private randomFactory: RandomIDFactory | null = null;
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
        this.diagnostics = new FDiagnostics(this);
        this.allKeys = new FGlobalSpace(this);
        this.nodeIdLayer = new FNodeIDLayer(this);
    }

    async ready(ctx: Context) {
        await this.nodeIdLayer.ready();
    }

    // Obsolete
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