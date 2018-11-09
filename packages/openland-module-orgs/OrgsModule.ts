import { OrganizationRepository } from './repositories/OrganizationRepository';
import { FDB } from 'openland-module-db/FDB';
import { OrganizatinProfileInput } from './OrganizationProfileInput';
import { inTx } from 'foundation-orm/inTx';
import { Emails } from 'openland-module-email/Emails';
import { Modules } from 'openland-modules/Modules';
import { ModulesRegistry } from 'openland-modules/ModulesRegistry';

export class OrgsModule {
    readonly registry: ModulesRegistry;
    private readonly repo: OrganizationRepository;

    constructor(registry: ModulesRegistry) {
        this.registry = registry;
        this.repo  = new OrganizationRepository(registry.DB.entities);
    }

    start = () => {
        // Nothing to do
    }

    async createOrganization(uid: number, input: OrganizatinProfileInput) {
        return inTx(async () => {
            let isEditor = (await Modules.Super.findSuperRole(uid)) === 'editor';
            let res = await this.repo.createOrganization(uid, input, isEditor);
            await Modules.Hooks.onOrganizstionCreated(uid, res.id);
            return res;
        });
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

    async addUserToOrganization(uid: number, oid: number) {
        return this.repo.addUserToOrganization(uid, oid, 'member');
    }

    async removeUserFromOrganization(uid: number, oid: number) {
        return this.repo.removeUserFromOrganization(uid, oid);
    }

    async renameOrganization(id: number, title: string) {
        return this.repo.renameOrganization(id, title);
    }

    async suspendOrganization(id: number) {
        return await inTx(async () => {
            if (await this.repo.suspendOrganization(id)) {
                for (let m of await FDB.OrganizationMember.allFromOrganization('joined', id)) {
                    let u = (await FDB.User.findById(m.uid))!;
                    if (u.status === 'activated') {
                        await Emails.sendAccountDeactivatedEmail(u.id);
                    }
                }
            }
            return (await FDB.Organization.findById(id))!;
        });
    }

    async pendOrganization(id: number) {
        return await inTx(async () => {
            await this.repo.pendOrganization(id);
            return (await FDB.Organization.findById(id))!;
        });
    }

    async activateOrganization(id: number) {
        return await inTx(async () => {
            if (await this.repo.activateOrganization(id)) {
                for (let m of await FDB.OrganizationMember.allFromOrganization('joined', id)) {
                    let u = (await FDB.User.findById(m.uid))!;
                    if (u.status !== 'activated') {
                        u.status = 'activated';
                        await Emails.sendWelcomeEmail(u.id);
                    }
                }
            }
            return (await FDB.Organization.findById(id))!;
        });
    }
}