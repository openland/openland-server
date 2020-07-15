import { Config } from 'openland-config/Config';
import { delay } from 'openland-utils/timer';
import { createLogger } from '@openland/log';
import { Store } from 'openland-module-db/FDB';
import { Context } from '@openland/context';
import { ClickHouseClient } from './ClickHouseClient';
import { DistributedLock } from '@openland/foundationdb-locks';
import { inTx } from '@openland/foundationdb';
import DatabaseClient from './DatabaseClient';
import { TableSpace } from './TableSpace';

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

migrations.push({
    name: '03-admins',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createTable(ctx, 'admins', [{
            name: 'uid',
            type: 'Int64'
        }],
            'uid',
            'uid',
            'uid');
    }
});

migrations.push({
    name: '04-bots',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createTable(ctx, 'bots', [{
            name: 'uid',
            type: 'Int64'
        }],
            'uid',
            'uid',
            'uid');
    }
});

migrations.push({
    name: '04-signups',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createTable(ctx, 'signups', [{
            name: 'time',
            type: 'DateTime'
        }, {
            name: 'uid',
            type: 'Int64'
        }],
            'toYYYYMM(time)',
            '(uid, time)',
            'uid');
    }
});

migrations.push({
    name: '05-user_activated',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createTable(ctx, 'user_activated', [{
            name: 'time',
            type: 'DateTime',
        }, {
            name: 'uid',
            type: 'Int64',
        }],
            'toYYYYMM(time)',
            '(uid, time)',
            'uid');
    }
});

migrations.push({
    name: '06-new-mobile-user',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createTable(ctx, 'new_mobile_user', [{
                name: 'time',
                type: 'DateTime',
            }, {
                name: 'uid',
                type: 'Int64',
            }],
            'toYYYYMM(time)',
            '(uid, time)',
            'uid');
    }
});

migrations.push({
    name: '07-new_sender',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createTable(ctx, 'new_sender', [{
                name: 'time',
                type: 'DateTime',
            }, {
                name: 'uid',
                type: 'Int64',
            }],
            'toYYYYMM(time)',
            '(uid, time)',
            'uid');
    }
});

migrations.push({
    name: '08-new_inviter',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createTable(ctx, 'new_inviter', [{
                name: 'time',
                type: 'DateTime',
            }, {
                name: 'uid',
                type: 'Int64',
            }, {
                name: 'invitee_id',
                type: 'Int64',
            }],
            'toYYYYMM(time)',
            '(uid, time)',
            'uid');
    }
});

migrations.push({
    name: '09-new-about-filler',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createTable(ctx, 'new_about_filler', [{
                name: 'time',
                type: 'DateTime',
            }, {
                name: 'uid',
                type: 'Int64',
            }],
            'toYYYYMM(time)',
            '(uid, time)',
            'uid');
    }
});

migrations.push({
    name: '10-new-three-like-getter',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createTable(ctx, 'new_three_like_getter', [{
                name: 'time',
                type: 'DateTime',
            }, {
                name: 'uid',
                type: 'Int64',
            }],
            'toYYYYMM(time)',
            '(uid, time)',
            'uid');
    }
});

migrations.push({
    name: '11-new-three-like-giver',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createTable(ctx, 'new_three_like_giver', [{
                name: 'time',
                type: 'DateTime',
            }, {
                name: 'uid',
                type: 'Int64',
            }],
            'toYYYYMM(time)',
            '(uid, time)',
            'uid');
    }
});

migrations.push({
    name: '12-new-reaction',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createTable(ctx, 'reaction', [{
                name: 'time',
                type: 'DateTime',
            }, {
                name: 'id',
                type: 'String',
            }, {
                name: 'uid',
                type: 'Int64',
            }, {
                name: 'mid',
                type: 'Int64',
            }, {
                name: 'message_author_id',
                type: 'Int64',
            }],
            'toYYYYMM(time)',
            '(id, uid, time)',
            'id');
    }
});

migrations.push({
    name: '13-call-ended',
    command: async (ctx: Context, client: DatabaseClient) => {
        await client.createTable(ctx, 'call_ended', [{
            name: 'time',
            type: 'DateTime',
        }, {
            name: 'duration',
            type: 'Int64'
        }, {
            name: 'id',
            type: 'String'
        }], 'toYYYYMM(time)',
            '(id, time)',
            'id');
    }
});

migrations.push({
    name: '14-platform-to-modern-presences',
    command: async (ctx: Context, client: DatabaseClient)  => {
        await client.query(ctx, `ALTER TABLE ${client.dbName}.presences_modern ADD COLUMN platform UInt8`);
    }
});

migrations.push({
    name: '14-clear-modern-presences',
    command: async (ctx: Context, client: DatabaseClient)  => {
        await client.query(ctx, `DROP TABLE ${client.dbName}.presences_modern`);
    }
});

migrations.push({
    name: '15-clear-modern-presences',
    command: async (ctx: Context, client: DatabaseClient)  => {
        await client.query(ctx, `DROP TABLE ${client.dbName}.presences_modern`);
    }
});

const logger = createLogger('clickhouse');

export async function createClient(ctx: Context) {
    let client = new ClickHouseClient(Config.clickhouse.endpoint, Config.clickhouse.user, Config.clickhouse.password);
    let db = client.withDatabase(Config.clickhouse.database);
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

    // Init newly added tables
    lock = new DistributedLock('clickhouse-tables', Store.storage.db, 1);
    while (true) {
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
            // Init all tables
            for (let table of TableSpace.all()) {
                await table.init(ctx, db);
            }
        } finally {
            TableSpace.lock();
            completed = true;
        }

        break;
    }

    return db;
}