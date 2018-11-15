import { FConnection } from './FConnection';
import { createLogger } from 'openland-log/createLogger';
import { SLog } from 'openland-log/SLog';
import { delay } from 'openland-utils/timer';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { withLogContext } from 'openland-log/withLogContext';
import { createEmptyContext } from 'openland-utils/Context';

export interface FMigration {
    key: string;
    migration: (log: SLog) => Promise<void>;
}

let log = createLogger('migration');
export async function performMigrations(connection: FConnection, migrations: FMigration[]) {
    try {
        if (migrations.length === 0) {
            return;
        }
        let appliedTransactions = (await connection.fdb.getRangeAll(FKeyEncoding.encodeKey(['__meta', 'migrations']))).map((v) => v[1] as any);
        let remaining = migrations.filter((v) => !appliedTransactions.find((m) => m.key === v.key));
        if (remaining.length > 0) {
            log.log(createEmptyContext(), 'Remaining migrations: ' + remaining.length);
            for (let m of remaining) {
                log.log(createEmptyContext(), 'Starting migration: ' + m.key);
                await withLogContext(m.key, async () => {
                    await m.migration(log);
                });
                await connection.fdb.set(FKeyEncoding.encodeKey(['__meta', 'migrations', m.key]), { key: m.key });
                log.log(createEmptyContext(), 'Completed migration: ' + m.key);
            }
            log.log(createEmptyContext(), 'All migrations are completed');
        }
    } catch (e) {
        log.warn(createEmptyContext(), 'Unable to apply migration', e);
        throw e;
    }
    await delay(1500000);
}