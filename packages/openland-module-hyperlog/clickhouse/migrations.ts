import { delay } from 'openland-utils/timer';
import { createLogger } from '@openland/log';
import { Store } from 'openland-module-db/FDB';
import { Context } from '@openland/context';
import { ClickHouseClient, DatabaseClient } from './ClickHouseClient';
import { DistributedLock } from '@openland/foundationdb-locks';
import { inTx } from '@openland/foundationdb';

const database = process.env.CLICKHOUSE_DB || 'openland';

interface Migration {
    name: string;
    command: (ctx: Context, client: DatabaseClient) => Promise<void>;
}
const migrations: Migration[] = [];

migrations.push({
    name: '01-db-create',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createDatabase(ctx);
    }
});
migrations.push({
    name: '02-presence-create',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createTable(ctx, 'presences', [{
            name: 'time',
            type: 'DateTime'
        }, {
            name: 'eid',
            type: 'String'
        }, {
            name: 'uid',
            type: 'Int64'
        }, {
            name: 'platform',
            type: 'String'
        }],
            'toYYYYMM(time)',
            '(eid, time)',
            'eid');
    }
});
migrations.push({
    name: '02-messages-create',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createTable(ctx, 'messages', [{
            name: 'time',
            type: 'DateTime'
        }, {
            name: 'id',
            type: 'String'
        }, {
            name: 'uid',
            type: 'Int64'
        }, {
            name: 'type',
            type: 'String'
        }, {
            name: 'service',
            type: 'UInt8'
        }],
            'toYYYYMM(time)',
            '(id, time)',
            'id');
    }
});

const logger = createLogger('clickhouse');

export async function createClient(ctx: Context) {
    if (!process.env.CLICKHOUSE_ENDPOINT) {
        throw Error('CLICKHOUSE_ENDPOINT variable is not set');
    }
    let endpoint = process.env.CLICKHOUSE_ENDPOINT;
    let username = process.env.CLICKHOUSE_USER || 'default';
    let password = process.env.CLICKHOUSE_PASSWORD || '';

    let client = new ClickHouseClient(endpoint, username, password);
    let db = client.withDatabase(database);
    let lock = new DistributedLock('clickhouse-migrations', Store.storage.db, 1);

    // Perform migrations
    while (true) {
        logger.log(ctx, 'Check pending migrations');
        let existing = await Store.ClickHouseMigrations.findById(ctx, 1);
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

    return db;
}