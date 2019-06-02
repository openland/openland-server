import { FConnection } from './FConnection';
import { createLogger } from 'openland-log/createLogger';
import { SLog } from 'openland-log/SLog';
import { delay } from 'openland-utils/timer';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { withLogContext } from 'openland-log/withLogContext';
import { Context } from '@openland/context';
import { encoders } from 'foundationdb';

export interface FMigration {
    key: string;
    migration: (ctx: Context, log: SLog) => Promise<void>;
}

let log = createLogger('migration');
export async function performMigrations(parent: Context, connection: FConnection, migrations: FMigration[]) {
    try {
        if (migrations.length === 0) {
            return;
        }
        let appliedTransactions = (await connection.fdb.getRangeAll(FKeyEncoding.encodeKey(['__meta', 'migrations']))).map((v) => encoders.json.unpack(v[1]));
        let remaining = migrations.filter((v) => !appliedTransactions.find((m) => m.key === v.key));
        if (remaining.length > 0) {
            log.log(parent, 'Remaining migrations: ' + remaining.length);
            for (let m of remaining) {
                log.log(parent, 'Starting migration: ' + m.key);
                let ctx = withLogContext(parent, [m.key]);
                await m.migration(ctx, log);
                await connection.fdb.set(FKeyEncoding.encodeKey(['__meta', 'migrations', m.key]), encoders.json.pack({ key: m.key }) as Buffer);
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