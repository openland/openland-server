import { Shutdown } from './../openland-utils/Shutdown';
import * as fs from 'fs';
import { Database, Layer } from '@openland/foundationdb';
import migrations from './migrations';
import { RandomLayer } from '@openland/foundationdb-random';
import { MigrationsLayer } from '@openland/foundationdb-migrations';
import { LockLayer } from '@openland/foundationdb-locks';
import { SingletonWorkerLayer } from '@openland/foundationdb-singleton';
import { BusLayer, NoOpBus } from '@openland/foundationdb-bus';
import { serverRoleEnabled } from '../openland-utils/serverRoleEnabled';
import { NatsBusEngine } from '../openland-module-pubsub/NatsBusEngine';
import { container } from '../openland-modules/Modules.container';
import { Config } from 'openland-config/Config';

let cachedDB: Database|null = null;

function createLayers(test: boolean) {
    // For some reason container.isBound returns true even if nats is not binded
    let natsBounded: boolean;
    try {
        container.get('NATS');
        natsBounded = true;
    } catch (e) {
        natsBounded = false;
    }

    let layers: Layer[] = [
        new RandomLayer(),
        new LockLayer(),
        new SingletonWorkerLayer(),
        new BusLayer(natsBounded ? new NatsBusEngine(container.get('NATS')) : new NoOpBus())
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
    if (Config.foundationdb) {
        fs.writeFileSync('foundation.clusterfile', Config.foundationdb.cluster);
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
    if (Config.foundationdb) {
        fs.writeFileSync('foundation.clusterfile', Config.foundationdb.cluster);
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
