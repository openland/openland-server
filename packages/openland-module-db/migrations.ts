import { staticWorker } from 'openland-module-workers/staticWorker';
import { performMigrations, FMigration } from 'foundation-orm/FMigrator';
import { FDB } from './FDB';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';

var migrations: FMigration[] = [];

export function startMigrationsWorker() {
    if (serverRoleEnabled('workers')) {
        staticWorker({ name: 'foundation-migrator' }, async () => {
            await performMigrations(FDB.connection, migrations);
            return false;
        });
    }
}