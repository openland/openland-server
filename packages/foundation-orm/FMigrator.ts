import { delay } from 'openland-utils/timer';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { Context } from '@openland/context';
import { encoders } from 'foundationdb';
import { createLogger, Logger, withLogPath } from '@openland/log';
import { Database } from '@openland/foundationdb';

export interface FMigration {
    key: string;
    migration: (ctx: Context, log: Logger) => Promise<void>;
}

let log = createLogger('migration');

export async function performMigrations(parent: Context, connection: Database, migrations: FMigration[]) {
    try {
        if (migrations.length === 0) {
            return;
        }
        let appliedTransactions = (await connection.rawDB.getRangeAll(FKeyEncoding.encodeKey(['__meta', 'migrations']))).map((v) => encoders.json.unpack(v[1]));
        let remaining = migrations.filter((v) => !appliedTransactions.find((m) => m.key === v.key));
        if (remaining.length > 0) {
            log.log(parent, 'Remaining migrations: ' + remaining.length);
            for (let m of remaining) {
                log.log(parent, 'Starting migration: ' + m.key);
                let ctx = withLogPath(parent, m.key);
                await m.migration(ctx, log);
                await connection.rawDB.set(FKeyEncoding.encodeKey(['__meta', 'migrations', m.key]), encoders.json.pack({ key: m.key }) as Buffer);
                log.log(parent, 'Completed migration: ' + m.key);
            }
            log.log(parent, 'All migrations are completed');
        }
    } catch (e) {
        log.warn(parent, 'Unable to apply migration', e);
        throw e;
    }
    await delay(1500000);
}