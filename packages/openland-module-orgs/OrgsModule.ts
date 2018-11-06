import { OrganizationRepository } from './repositories/OrganizationRepository';
import { FDB } from 'openland-module-db/FDB';

export class OrgsModule {
    readonly repo = new OrganizationRepository(FDB);
    
    start = () => {
        // Nothing to do
    }
}