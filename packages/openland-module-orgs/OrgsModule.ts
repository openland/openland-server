import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { startMigrations } from './Migrations';

export class OrgsModule {
    start = () => {
        if (serverRoleEnabled('workers')) {
            startMigrations();
        }
    }
}