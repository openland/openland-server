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
    async findOrganizationMembership(oid: number) {
        return this.repo.findOrganizationMembership(oid);
    }

    async findUserOrganizations(uid: number) {
        return this.repo.findUserOrganizations(uid);
    }

    async isUserMember(uid: number, orgId: number) {
        return this.repo.isUserMember(uid, orgId);
    }

    async isUserAdmin(uid: number, oid: number) {
        return this.repo.isUserAdmin(uid, oid);
    }

    async hasMemberWithEmail(oid: number, email: string) {
        return this.repo.hasMemberWithEmail(oid, email);
    }

    async fundUserMembership(uid: number, oid: number) {
        return this.repo.fundUserMembership(uid, oid);
    }
}