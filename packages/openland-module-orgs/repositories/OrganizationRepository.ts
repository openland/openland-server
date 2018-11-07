import { AllEntities } from 'openland-module-db/schema';

export class OrganizationRepository {
    readonly entities: AllEntities;
    
    constructor(entities: AllEntities) {
        this.entities = entities;
    }

    async findOrganizationMembers(organizationId: number) {
        return (await Promise.all((await this.entities.OrganizationMember.allFromOrganization('joined', organizationId))
            .map((v) => this.entities.User.findById(v.uid))))
            .map((v) => v!);
    }

    async findUserOrganizations(uid: number): Promise<number[]> {
        return (await this.entities.OrganizationMember.allFromUser('joined', uid)).map((v) => v.oid);
    }

    async isUserMember(uid: number, orgId: number): Promise<boolean> {
        let isMember = await this.entities.OrganizationMember.findById(orgId, uid);
        return !!(isMember && isMember.status === 'joined');
    }
}