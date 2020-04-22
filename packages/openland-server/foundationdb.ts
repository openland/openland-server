import { Shutdown } from './../openland-utils/Shutdown';
import * as fs from 'fs';
import { Database, Layer } from '@openland/foundationdb';
import migrations from './migrations';
import { RandomLayer } from '@openland/foundationdb-random';
import { MigrationsLayer } from '@openland/foundationdb-migrations';
import { LockLayer } from '@openland/foundationdb-locks';
import { SingletonWorkerLayer } from '@openland/foundationdb-singleton';
import { BusLayer } from '@openland/foundationdb-bus';
import { serverRoleEnabled } from '../openland-utils/serverRoleEnabled';
import { NatsBusProvider } from '../openland-module-pubsub/NatsBusProvider';
import { container } from '../openland-modules/Modules.container';

let cachedDB: Database|null = null;

function createLayers(test: boolean) {
    let layers: Layer[] = [
        new RandomLayer(),
        new LockLayer(),
        new SingletonWorkerLayer(),
        new BusLayer(new NatsBusProvider(container.get('NATS')))
    ];
    if (serverRoleEnabled('admin') && !test) {
        layers.push(new MigrationsLayer(migrations));
    }
    return layers;
}

export async function openDatabase() {
    if (cachedDB) {
        return cachedDB;
    }
    let db: Database;
    if (process.env.FOUNDATION_DB) {
        fs.writeFileSync('foundation.clusterfile', process.env.FOUNDATION_DB);
        db = await Database.open({ clusterFile: 'foundation.clusterfile', layers: createLayers(false) });
    } else {
        db = await Database.open({ layers: createLayers(false) });
    }
    Shutdown.registerWork({
        name: 'database',
        shutdown: async (ctx) => {
            return new Promise(resolve => {
                // tslint:disable-next-line:no-floating-promises
                db.close(ctx);
                setTimeout(() => resolve(), 1000);
            });
        },
        last: true
    });
    cachedDB = db;
    return db;
}

export async function openTestDatabase() {
    let db: Database;
    if (process.env.FOUNDATION_DB) {
        fs.writeFileSync('foundation.clusterfile', process.env.FOUNDATION_DB);
        db = await Database.openTest({ clusterFile: 'foundation.clusterfile', layers: createLayers(true) });
    } else {
        db = await Database.openTest({ layers: createLayers(true) });
    }
    Shutdown.registerWork({
        name: 'database',
        shutdown: async (ctx) => {
            return new Promise(resolve => {
                // tslint:disable-next-line:no-floating-promises
                db.close(ctx);
                setTimeout(() => resolve(), 1000);
            });
        },
        last: true
    });
    return db;
}
