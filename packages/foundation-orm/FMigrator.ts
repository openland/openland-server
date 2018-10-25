import { FConnection } from './FConnection';
import { createLogger } from 'openland-log/createLogger';
import { SLog } from 'openland-log/SLog';
import { delay } from 'openland-server/utils/timer';

export interface FMigration {
    key: string;
    migration: (log: SLog) => Promise<void>;
}

let log = createLogger('migration');
export async function performMigrations(connection: FConnection, migrations: FMigration[]) {
    if (migrations.length === 0) {
        return;
    }
    let appliedTransactions = (await connection.fdb.getRangeAll(['__meta', 'migrations'])).map((v) => v[1] as any);
    let remaining = migrations.filter((v) => !appliedTransactions.find((m) => m.key === v.key));
    if (remaining.length > 0) {
        log.log('Remaining migrations: ' + remaining.length);
        for (let m of remaining) {
            log.log('Starting migration: ' + m.key);
            await m.migration(log);
            await connection.fdb.set(['__meta', 'migrations', m.key], { key: m.key });
            log.log('Completed migration: ' + m.key);
        }
        log.log('All migrations are completed');
    }
    await delay(1500000);
}