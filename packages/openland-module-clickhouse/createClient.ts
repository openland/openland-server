import { createLogger } from '@openland/log';
import { Context } from '@openland/context';
import DatabaseClient from './DatabaseClient';
import { DistributedLock } from '@openland/foundationdb-locks';
import { Store } from '../openland-module-db/FDB';
import { delay } from '../openland-utils/timer';
import { inTx } from '@openland/foundationdb';
import { TableSpace } from './TableSpace';
import { ClickHouseClient } from './ClickHouseClient';
import { Config } from '../openland-config/Config';
import { serverRoleEnabled } from '../openland-utils/serverRoleEnabled';
import { migrations } from './migrations';

const logger = createLogger('clickhouse');

async function performMigrations(ctx: Context, db: DatabaseClient) {
    let lock = new DistributedLock('clickhouse-migrations', Store.storage.db, 1);

    // Perform migrations
    while (true) {
        logger.log(ctx, 'Check pending migrations');
        let existing = await inTx(ctx, async (tx) => await Store.ClickHouseMigrations.findById(tx, 1));
        let applied: string[] = [];
        if (existing) {
            applied = existing.applied;
        }

        // If no migrations needed
        if (!migrations.find((v) => !applied.find((v2) => v2 === v.name))) {
            logger.log(ctx, 'No pending migrations found');
            break;
        }

        // Trying to get lock
        let acquired = await lock.tryLock(ctx, 5000);
        if (!acquired) {
            logger.log(ctx, 'Unable to get lock: retrying');
            await delay(1000);
            continue;
        }

        let completed = false;

        // Lock refresh and release
        // tslint:disable-next-line:no-floating-promises
        (async () => {
            while (!completed) {
                await lock.refresh(ctx, 5000);
                await delay(500);
            }
            await lock.releaseLock(ctx);
        })();

        try {
            // Applying migrations
            for (let m of migrations) {
                if (applied.find((v) => v === m.name)) {
                    continue;
                }

                logger.log(ctx, 'Applying migration ' + m.name);
                await m.command(ctx, db);
            }

            logger.log(ctx, 'All migrations applied');
        } finally {
            completed = true;
        }

        await inTx(ctx, async (tx) => {
            let mig = await Store.ClickHouseMigrations.findById(tx, 1);
            if (!mig) {
                await Store.ClickHouseMigrations.create(tx, 1, { applied });
            } else {
                // Update applied migrations list
                let updated = [...mig.applied];
                for (let m of migrations) {
                    if (!applied.find((v) => v === m.name)) {
                        updated.push(m.name);
                    }
                }
                mig.applied = updated;
            }
        });

        break;
    }
}

export async function createClient(ctx: Context) {
    let client = new ClickHouseClient(Config.clickhouse.endpoint, Config.clickhouse.user, Config.clickhouse.password);
    let db = client.withDatabase(Config.clickhouse.database);
    TableSpace.lock();

    // perform migrations only on admin
    if (serverRoleEnabled('admin') && false) {
        await performMigrations(ctx, db);
    }

    return db;
}