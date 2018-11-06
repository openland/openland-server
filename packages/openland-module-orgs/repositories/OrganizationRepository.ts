import { AllEntities } from 'openland-module-db/schema';

export class OrganizationRepository {
    readonly entities: AllEntities;
    
    constructor(entities: AllEntities) {
        this.entities = entities;
    }
}