import { Shutdown } from './../openland-utils/Shutdown';
import * as fs from 'fs';
import { Database, Layer } from '@openland/foundationdb';
import migrations from './migrations';
import { RandomLayer } from '@openland/foundationdb-random';
import { MigrationsLayer } from '@openland/foundationdb-migrations';
import { LockLayer } from '@openland/foundationdb-locks';
import { SingletonWorkerLayer } from '@openland/foundationdb-singleton';
import { BusLayer, NoOpBus } from '@openland/foundationdb-bus';
import { RedisBusProvider } from '@openland/foundationdb-bus-redis';
import { serverRoleEnabled } from '../openland-utils/serverRoleEnabled';

let cachedDB: Database|null = null;

function createLayers(test: boolean) {
    let layers: Layer[] = [
        new RandomLayer(),
        new LockLayer(),
        new SingletonWorkerLayer(),
        new BusLayer(
            !process.env.REDIS_HOST
                ? new NoOpBus()
                : new RedisBusProvider(
                    process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT as string, 10) : 6379,
                    process.env.REDIS_HOST
                ))
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
        }
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
        }
    });
    return db;
}
