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
import { lazyInject } from '../openland-modules/Modules.container';
import { UserError } from '../openland-errors/UserError';

@injectable()
export class OrganizationModule {
    @lazyInject('OrganizationRepository')
    private readonly repo!: OrganizationRepository;

    start = () => {
        if (serverRoleEnabled('workers')) {
            organizationProfileIndexer();
        }
    }

    async createOrganization(parent: Context, uid: number, input: OrganizatinProfileInput) {
        return inTx(parent, async (ctx) => {

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

            if (user.status !== 'activated' && (await this.findUserOrganizations(ctx, uid)).length === 1) {
                await Modules.Hooks.onUserProfileCreated(ctx, uid);
            }

            return res;
        });
    }

    async activateOrganization(parent: Context, id: number, sendEmail: boolean) {
        return await inTx(parent, async (ctx) => {
            if (await this.repo.activateOrganization(ctx, id)) {
                if (sendEmail) {
                    await Emails.sendAccountActivatedEmail(ctx, id);
                }
                for (let m of await FDB.OrganizationMember.allFromOrganization(ctx, 'joined', id)) {
                    await Modules.Users.activateUser(ctx, m.uid, false);
                    let profile = await FDB.UserProfile.findById(ctx, m.uid);
                    if (profile && !profile.primaryOrganization) {
                        profile.primaryOrganization = id;
                    }
                }
                return true;
            }
            return false;
        });
    }

    async suspendOrganization(parent: Context, id: number) {
        return await inTx(parent, async (ctx) => {
            if (await this.repo.suspendOrganization(ctx, id)) {
                await Emails.sendAccountDeactivatedEmail(ctx, id);
                return true;
            }
            return false;
        });
    }

    async addUserToOrganization(parent: Context, uid: number, oid: number, by: number, skipChecks: boolean = false, isNewUser: boolean = false) {
        return await inTx(parent, async (ctx) => {

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

            let member = await Modules.DB.entities.OrganizationMember.findById(ctx, oid, by);
            let isSuperAdmin = (await Modules.Super.superRole(ctx, by)) === 'super-admin';
            let canAdd = (member && member.status === 'joined') || isSuperAdmin || skipChecks;
            if (!canAdd) {
                throw new AccessDeniedError('Only members can add members');
            }

            // Add member
            if (await this.repo.addUserToOrganization(ctx, uid, oid, by)) {
                let org = (await Modules.DB.entities.Organization.findById(ctx, oid))!;
                if (org.status === 'activated') {
                    // Activate user if organization is in activated state
                    await Modules.Users.activateUser(ctx, uid, isNewUser);

                    // Find and activate organizations created by user if have one
                    let userOrgs = await Promise.all((await this.findUserOrganizations(ctx, uid)).map(orgId => Modules.DB.entities.Organization.findById(ctx, orgId)));
                    userOrgs = userOrgs.filter(o => o!.ownerId === uid);
                    for (let userOrg of userOrgs) {
                        // Activate user organization
                        if (await this.activateOrganization(ctx, userOrg!.id, !isNewUser)) {
                            await Modules.Hooks.onOrganizationActivated(ctx, userOrg!.id, { type: 'OWNER_ADDED_TO_ORG', owner: by, otherOid: oid });
                        }
                    }

                    if (org.kind === 'organization') {
                        // Update primary organization if needed
                        if (!profile.primaryOrganization) {
                            profile.primaryOrganization = oid;
                        }
                    } else if (org.kind === 'community') {
                        if (!profile.primaryOrganization && userOrgs.length > 0) {
                            profile.primaryOrganization = userOrgs[0]!.id;
                        }
                    }
                }
                return org;
            }

            return await Modules.DB.entities.Organization.findById(ctx, oid);
        });
    }

    async removeUserFromOrganization(parent: Context, uid: number, oid: number, by: number) {
        return await inTx(parent, async (ctx) => {

            // Check current membership state
            let member = await FDB.OrganizationMember.findById(ctx, oid, uid);
            if (!member) {
                return false;
            }
            if (member.status === 'left') {
                return false;
            }

            let superRoles = await Modules.Super.superRole(ctx, by);

            // Check permissions
            let isAdmin = await this.isUserAdmin(ctx, by, oid);
            let invitedByUser = (member.invitedBy && (member.invitedBy === by)) || false;
            if (!isAdmin && !invitedByUser && superRoles !== 'super-admin' && uid !== by) {
                throw new AccessDeniedError(ErrorText.permissionDenied);
            }

            // Disallow kicking admins by non-admins
            if (member.role === 'admin' && !isAdmin && superRoles !== 'super-admin') {
                throw new AccessDeniedError(ErrorText.permissionDenied);
            }

            // Disallow owner kick
            if (await this.isUserOwner(ctx, uid, oid)) {
                throw new UserError('Can\'t kick organization owner');
            }

            // Disallow kick if it is last user organization
            if (await this.findUserOrganizations(ctx, uid)) {
                let orgs = await this.repo.findUserOrganizations(ctx, uid);
                if (orgs.length === 1) {
                    throw new UserError('You cannot leave your only organization');
                }
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
                let userGroups = await FDB.RoomParticipant.allFromUserActive(ctx, uid);
                for (let group of userGroups) {
                    let conv = await FDB.Conversation.findById(ctx, group.cid);
                    if (!conv) {
                        continue;
                    }
                    if (conv.kind === 'room') {
                        let room = await FDB.ConversationRoom.findById(ctx, conv.id);
                        if (!room) {
                            continue;
                        }

                        if (room.oid && room.oid === oid) {
                            if (uid === by) {
                                await Modules.Messaging.room.leaveRoom(ctx, room.id, uid);
                            } else {
                                await Modules.Messaging.room.kickFromRoom(ctx, room.id, by, uid);
                            }
                        }
                    }
                }
                await Emails.sendMemberRemovedEmail(ctx, oid, uid);
                return true;
            }

            return false;
        });
    }

    async deleteOrganization(parent: Context, uid: number, oid: number) {
        return await this.repo.deleteOrganization(parent, uid, oid);
    }

    //
    // Permissions
    //

    async updateMemberRole(parent: Context, uid: number, oid: number, role: 'admin' | 'member', by: number) {
        return await inTx(parent, async (ctx) => {
            let isOwner = await this.isUserOwner(ctx, by, oid);
            if (!isOwner) {
                throw new AccessDeniedError('Only owners can change roles');
            }
            if (await this.isUserOwner(ctx, uid, oid)) {
                throw new AccessDeniedError('Owner role can\'t be changed');
            }
            let res = await this.repo.updateMembershipRole(ctx, uid, oid, role);
            await Emails.sendMembershipLevelChangedEmail(ctx, oid, uid);
            return res;
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

    async findOrganizationMembersWithStatus(ctx: Context, oid: number, status: 'requested' | 'joined' | 'left') {
        return this.repo.findOrganizationMembersWithStatus(ctx, oid, status);
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