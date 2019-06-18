import * as fs from 'fs';
import { Database, Subspace } from '@openland/foundationdb';

export class FConnection {
    readonly fdb: Database;
    readonly allKeys: Subspace;

    static create() {
        let db: Database;
        if (process.env.FOUNDATION_DB) {
            fs.writeFileSync('foundation.clusterfile', process.env.FOUNDATION_DB);
            db = Database.open('foundation.clusterfile');
        } else {
            db = Database.open();
        }
        return db;
    }

    static async createTest() {
        return await Database.openTest();
    }

    constructor(db: Database) {
        this.fdb = db;
        this.allKeys = db.allKeys;
    }
}