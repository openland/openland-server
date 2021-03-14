import { Shutdown } from './../openland-utils/Shutdown';
import * as fs from 'fs';
import { Database, Layer } from '@openland/foundationdb';
import migrations from './migrations';
import { RandomLayer } from '@openland/foundationdb-random';
import { MigrationsLayer } from '@openland/foundationdb-migrations';
import { LockLayer } from '@openland/foundationdb-locks';
import { SingletonWorkerLayer } from '@openland/foundationdb-singleton';
import { BusLayer, BusProvider, NoOpBus } from '@openland/foundationdb-bus';
import { serverRoleEnabled } from '../openland-utils/serverRoleEnabled';
import { NatsBusEngine } from '../openland-module-pubsub/NatsBusEngine';
import { container } from '../openland-modules/Modules.container';
import { Config } from 'openland-config/Config';
import { RedisBusProvider } from '@openland/foundationdb-bus-redis';
import { URL } from 'url';

let cachedDB: Database | null = null;

function createLayers(test: boolean) {
    let busProvider: BusProvider = new NoOpBus();
    if (Config.redis) {
        let redis = new URL(Config.redis.endpoint);
        let host = redis.hostname;
        let port = parseInt(redis.port, 10);
        busProvider = new RedisBusProvider(port, host);
    } else {
        // For some reason container.isBound returns true even if nats is not binded
        try {
            busProvider = new NatsBusEngine(container.get('NATS'));
        } catch (e) {
            // Could throw if NATS is not inited
        }
    }

    let layers: Layer[] = [
        new RandomLayer(),
        new LockLayer(),
        new SingletonWorkerLayer(),
        new BusLayer(busProvider)
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
