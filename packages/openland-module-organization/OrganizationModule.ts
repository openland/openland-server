import { injectable } from 'inversify';
import { OrganizationRepository } from './repositories/OrganizationRepository';
import { FDB } from 'openland-module-db/FDB';
import { OrganizatinProfileInput } from './OrganizationProfileInput';
import { inTx } from 'foundation-orm/inTx';
import { Emails } from 'openland-module-email/Emails';
import { Modules } from 'openland-modules/Modules';
import { ErrorText } from 'openland-errors/ErrorText';
import { AccessDeniedError } from 'openland-errors/AccessDeniedError';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { organizationProfileIndexer } from './workers/organizationProfileIndexer';

@injectable()
export class OrganizationModule {
    private readonly repo: OrganizationRepository;

    constructor() {
        this.repo = new OrganizationRepository(Modules.DB.entities);
    }

    start = () => {
        if (serverRoleEnabled('workers')) {
            organizationProfileIndexer();
        }
    }

    async createOrganization(uid: number, input: OrganizatinProfileInput) {
        return inTx(async () => {

            // 1. Resolve user status
            let status: 'activated' | 'pending' = 'pending';
            let user = await Modules.DB.entities.User.findById(uid);
            if (!user) {
                throw Error('Unable to find user');
            }
            if (user.status === 'activated') {
                status = 'activated';
            } else if (user.status === 'suspended') {
                throw Error('User is suspended');
            }

            // 2. Check if profile created
            let profile = await Modules.DB.entities.UserProfile.findById(uid);
            if (!profile) {
                throw Error('Profile is not created');
            }

            // 3. Resolve editorial flag
            let editorial = (await Modules.Super.findSuperRole(uid)) === 'editor';

            // 4. Create Organization
            let res = await this.repo.createOrganization(uid, input, { editorial, status });

            // 5. Update primary organization if needed
            if (status === 'activated') {
                if (!profile.primaryOrganization) {
                    profile.primaryOrganization = res.id;
                }
            }

            // 6. Invoke Hook
            await Modules.Hooks.onOrganizationCreated(uid, res.id);

            return res;
        });
    }

    async activateOrganization(id: number) {
        return await inTx(async () => {
            if (await this.repo.activateOrganization(id)) {
                for (let m of await FDB.OrganizationMember.allFromOrganization('joined', id)) {
                    await Modules.Users.activateUser(m.uid);
                    let profile = await FDB.UserProfile.findById(m.uid);
                    if (profile && !profile.primaryOrganization) {
                        profile.primaryOrganization = id;
                    }
                }
            }
            return (await FDB.Organization.findById(id))!;
        });
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

    async addUserToOrganization(uid: number, oid: number, by: number) {
        return await inTx(async () => {

            // Check user state
            let user = await Modules.DB.entities.User.findById(uid);
            if (!user) {
                throw Error('Unable to find user');
            }
            if (user.status === 'suspended') {
                throw Error('User is suspended');
            }
            let profile = await Modules.DB.entities.UserProfile.findById(uid);
            if (!profile) {
                throw Error('Profile is not created');
            }

            // Add member
            if (await this.repo.addUserToOrganization(uid, oid, by)) {
                let org = (await Modules.DB.entities.Organization.findById(oid))!;
                if (org.status === 'activated') {

                    // Activate user if organization is in activated state
                    await Modules.Users.activateUser(uid);

                    // Update primary organization if needed
                    if (!profile.primaryOrganization) {
                        profile.primaryOrganization = oid;
                    }
                }
                return org;
            }

            return await Modules.DB.entities.Organization.findById(oid);
        });
    }

    async removeUserFromOrganization(uid: number, oid: number, by: number) {
        return await inTx(async () => {

            // Check current membership state
            let member = await FDB.OrganizationMember.findById(oid, uid);
            if (!member) {
                return false;
            }
            if (member.status === 'left') {
                return false;
            }

            // Check permissions
            let isAdmin = await this.isUserAdmin(by, oid);
            let invitedByUser = (member.invitedBy && (member.invitedBy === uid)) || false;
            if (!isAdmin && !invitedByUser) {
                throw new AccessDeniedError(ErrorText.permissionDenied);
            }

            // Disallow kicking admins by non-admins
            if (member.role === 'admin' && !isAdmin) {
                throw new AccessDeniedError(ErrorText.permissionDenied);
            }

            // Disallow owner kick
            if (await this.isUserOwner(uid, oid)) {
                throw new AccessDeniedError(ErrorText.permissionDenied);
            }

            if (await this.repo.removeUserFromOrganization(uid, oid)) {
                let profile = (await FDB.UserProfile.findById(uid))!;
                if (profile.primaryOrganization === oid) {
                    let orgs = await this.repo.findUserOrganizations(uid);
                    if (orgs.length === 0) {
                        profile.primaryOrganization = null;
                    } else {
                        profile.primaryOrganization = orgs[0];
                    }
                    await profile.flush();
                }
                return true;
            }

            return false;
        });
    }

    //
    // Permissions
    //

    async updateMemberRole(uid: number, oid: number, role: 'admin' | 'member', by: number) {
        return await inTx(async () => {
            let isOwner = await this.isUserOwner(by, oid);
            if (!isOwner) {
                throw new AccessDeniedError('Only owners can change roles');
            }
            if (await this.isUserOwner(uid, oid)) {
                throw new AccessDeniedError('Owner role can\'t be changed');
            }

            return await this.repo.updateMembershipRole(uid, oid, role);
        });
    }

    async isUserMember(uid: number, orgId: number) {
        return this.repo.isUserMember(uid, orgId);
    }

    async isUserAdmin(uid: number, oid: number) {
        return this.repo.isUserAdmin(uid, oid);
    }

    async isUserOwner(uid: number, oid: number) {
        return this.repo.isUserOwner(uid, oid);
    }

    //
    // Queries
    //

    async findOrganizationMembers(organizationId: number) {
        return this.repo.findOrganizationMembers(organizationId);
    }

    async findUserOrganizations(uid: number) {
        return this.repo.findUserOrganizations(uid);
    }

    async findOrganizationMembership(oid: number) {
        return this.repo.findOrganizationMembership(oid);
    }

    async hasMemberWithEmail(oid: number, email: string) {
        return this.repo.hasMemberWithEmail(oid, email);
    }

    async findUserMembership(uid: number, oid: number) {
        return this.repo.findUserMembership(uid, oid);
    }

    async markForUndexing(oid: number) {
        await this.repo.markForUndexing(oid);
    }

    //
    // Deprecated
    //

    async renameOrganization(id: number, title: string) {
        return this.repo.renameOrganization(id, title);
    }
}