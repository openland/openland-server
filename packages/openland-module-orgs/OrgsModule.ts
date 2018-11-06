import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { startMigrations } from './Migrations';
import { OrganizationRepository } from './repositories/OrganizationRepository';
import { FDB } from 'openland-module-db/FDB';

export class OrgsModule {
    readonly repo = new OrganizationRepository(FDB);
    
    start = () => {
        if (serverRoleEnabled('workers')) {
            startMigrations();
        }
    }
}