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
import { Context } from 'openland-utils/Context';

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

    async createOrganization(ctx: Context, uid: number, input: OrganizatinProfileInput) {
        return inTx(async () => {

            // 1. Resolve user status
            let status: 'activated' | 'pending' = 'pending';
            let user = await Modules.DB.entities.User.findById(ctx, uid);
            if (!user) {
                throw Error('Unable to find user');
            }
            if (user.status === 'activated') {
                status = 'activated';
            } else if (user.status === 'suspended') {
                throw Error('User is suspended');
            }

            // 2. Check if profile created
            let profile = await Modules.DB.entities.UserProfile.findById(ctx, uid);
            if (!profile) {
                throw Error('Profile is not created');
            }

            // 3. Resolve editorial flag
            let editorial = (await Modules.Super.findSuperRole(ctx, uid)) === 'editor';

            // 4. Create Organization
            let res = await this.repo.createOrganization(ctx, uid, input, { editorial, status });

            // 5. Update primary organization if needed
            if (status === 'activated') {
                if (!profile.primaryOrganization) {
                    profile.primaryOrganization = res.id;
                }
            }

            // 6. Invoke Hook
            await Modules.Hooks.onOrganizationCreated(ctx, uid, res.id);

            return res;
        });
    }

    async activateOrganization(ctx: Context, id: number) {
        return await inTx(async () => {
            if (await this.repo.activateOrganization(ctx, id)) {
                for (let m of await FDB.OrganizationMember.allFromOrganization(ctx, 'joined', id)) {
                    await Modules.Users.activateUser(ctx, m.uid);
                    let profile = await FDB.UserProfile.findById(ctx, m.uid);
                    if (profile && !profile.primaryOrganization) {
                        profile.primaryOrganization = id;
                    }
                }
            }
            return (await FDB.Organization.findById(ctx, id))!;
        });
    }

    async suspendOrganization(ctx: Context, id: number) {
        return await inTx(async () => {
            if (await this.repo.suspendOrganization(ctx, id)) {
                for (let m of await FDB.OrganizationMember.allFromOrganization(ctx, 'joined', id)) {
                    let u = (await FDB.User.findById(ctx, m.uid))!;
                    if (u.status === 'activated') {
                        await Emails.sendAccountDeactivatedEmail(ctx, u.id);
                    }
                }
            }
            return (await FDB.Organization.findById(ctx, id))!;
        });
    }

    async addUserToOrganization(ctx: Context, uid: number, oid: number, by: number) {
        return await inTx(async () => {

            // Check user state
            let user = await Modules.DB.entities.User.findById(ctx, uid);
            if (!user) {
                throw Error('Unable to find user');
            }
            if (user.status === 'suspended') {
                throw Error('User is suspended');
            }
            let profile = await Modules.DB.entities.UserProfile.findById(ctx, uid);
            if (!profile) {
                throw Error('Profile is not created');
            }

            // Add member
            if (await this.repo.addUserToOrganization(ctx, uid, oid, by)) {
                let org = (await Modules.DB.entities.Organization.findById(ctx, oid))!;
                if (org.status === 'activated') {

                    // Activate user if organization is in activated state
                    await Modules.Users.activateUser(ctx, uid);

                    // Update primary organization if needed
                    if (!profile.primaryOrganization) {
                        profile.primaryOrganization = oid;
                    }
                }
                return org;
            }

            return await Modules.DB.entities.Organization.findById(ctx, oid);
        });
    }

    async removeUserFromOrganization(ctx: Context, uid: number, oid: number, by: number) {
        return await inTx(async () => {

            // Check current membership state
            let member = await FDB.OrganizationMember.findById(ctx, oid, uid);
            if (!member) {
                return false;
            }
            if (member.status === 'left') {
                return false;
            }

            // Check permissions
            let isAdmin = await this.isUserAdmin(ctx, by, oid);
            let invitedByUser = (member.invitedBy && (member.invitedBy === uid)) || false;
            if (!isAdmin && !invitedByUser) {
                throw new AccessDeniedError(ErrorText.permissionDenied);
            }

            // Disallow kicking admins by non-admins
            if (member.role === 'admin' && !isAdmin) {
                throw new AccessDeniedError(ErrorText.permissionDenied);
            }

            // Disallow owner kick
            if (await this.isUserOwner(ctx, uid, oid)) {
                throw new AccessDeniedError(ErrorText.permissionDenied);
            }

            if (await this.repo.removeUserFromOrganization(ctx, uid, oid)) {
                let profile = (await FDB.UserProfile.findById(ctx, uid))!;
                if (profile.primaryOrganization === oid) {
                    let orgs = await this.repo.findUserOrganizations(ctx, uid);
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

    async updateMemberRole(ctx: Context, uid: number, oid: number, role: 'admin' | 'member', by: number) {
        return await inTx(async () => {
            let isOwner = await this.isUserOwner(ctx, by, oid);
            if (!isOwner) {
                throw new AccessDeniedError('Only owners can change roles');
            }
            if (await this.isUserOwner(ctx, uid, oid)) {
                throw new AccessDeniedError('Owner role can\'t be changed');
            }

            return await this.repo.updateMembershipRole(ctx, uid, oid, role);
        });
    }

    async isUserMember(ctx: Context, uid: number, orgId: number) {
        return this.repo.isUserMember(ctx, uid, orgId);
    }

    async isUserAdmin(ctx: Context, uid: number, oid: number) {
        return this.repo.isUserAdmin(ctx, uid, oid);
    }

    async isUserOwner(ctx: Context, uid: number, oid: number) {
        return this.repo.isUserOwner(ctx, uid, oid);
    }

    //
    // Queries
    //

    async findOrganizationMembers(ctx: Context, organizationId: number) {
        return this.repo.findOrganizationMembers(ctx, organizationId);
    }

    async findUserOrganizations(ctx: Context, uid: number) {
        return this.repo.findUserOrganizations(ctx, uid);
    }

    async findOrganizationMembership(ctx: Context, oid: number) {
        return this.repo.findOrganizationMembership(ctx, oid);
    }

    async hasMemberWithEmail(ctx: Context, oid: number, email: string) {
        return this.repo.hasMemberWithEmail(ctx, oid, email);
    }

    async findUserMembership(ctx: Context, uid: number, oid: number) {
        return this.repo.findUserMembership(ctx, uid, oid);
    }

    async markForUndexing(ctx: Context, oid: number) {
        await this.repo.markForUndexing(ctx, oid);
    }

    //
    // Deprecated
    //

    async renameOrganization(ctx: Context, id: number, title: string) {
        return this.repo.renameOrganization(ctx, id, title);
    }
}