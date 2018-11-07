import { OrganizationRepository } from './repositories/OrganizationRepository';
import { FDB } from 'openland-module-db/FDB';
import { OrganizatinProfileInput } from './OrganizationProfileInput';

export class OrgsModule {
    private readonly repo = new OrganizationRepository(FDB);

    start = () => {
        // Nothing to do
    }

    async createOrganization(uid: number, input: OrganizatinProfileInput) {
        return this.repo.createOrganization(uid, input);
    }

    async findOrganizationMembers(organizationId: number) {
        return this.repo.findOrganizationMembers(organizationId);
    }

    async findUserOrganizations(uid: number) {
        return this.repo.findUserOrganizations(uid);
    }

    async isUserMember(uid: number, orgId: number) {
        return this.repo.isUserMember(uid, orgId);
    }
}