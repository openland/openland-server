import { inTx } from '@openland/foundationdb';
import { injectable } from 'inversify';
import { OrganizationRepository } from './repositories/OrganizationRepository';
import { Store } from 'openland-module-db/FDB';
import { OrganizatinProfileInput } from './OrganizationProfileInput';
import { Emails } from 'openland-module-email/Emails';
import { Modules } from 'openland-modules/Modules';
import { ErrorText } from 'openland-errors/ErrorText';
import { AccessDeniedError } from 'openland-errors/AccessDeniedError';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { organizationProfileIndexer } from './workers/organizationProfileIndexer';
import { Context } from '@openland/context';
import { lazyInject } from '../openland-modules/Modules.container';
import { UserError } from '../openland-errors/UserError';
import { User, UserProfile } from '../openland-module-db/store';

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
            // 1. Ensure user is not suspended and has profile
            let [user, profile] = await this.getUnsuspendedUserWithProfile(ctx, uid);

            // 2. Resolve editorial flag
            let editorial = (await Modules.Super.findSuperRole(ctx, uid)) === 'editor';

            // 3. Create Organization
            let res = await this.repo.createOrganization(ctx, uid, input, { editorial, status: 'activated' });

            // 4. Update primary organization if needed
            if (!profile.primaryOrganization && !input.isCommunity) {
                profile.primaryOrganization = res.id;
            }

            // 5. Activate user if needed and call hooks
            if (user.status === 'pending') {
                await Modules.Users.activateUser(ctx, uid, true);
                if (user.invitedBy) {
                    await Modules.Hooks.onFirstOrganizationActivated(ctx, res.id, { type: 'BY_INVITE', inviteOwner: user.invitedBy, inviteType: 'APP', uid });
                } else {
                    await Modules.Hooks.onFirstOrganizationActivated(ctx, res.id, { type: 'ACTIVATED_AUTOMATICALLY', uid });
                }
            }

            // 6. Invoke Hook
            await Modules.Hooks.onOrganizationCreated(ctx, uid, res.id);
            return res;
        });
    }

    async activateOrganization(parent: Context, id: number, sendEmail: boolean, byAdmin: boolean = false) {
        return await inTx(parent, async (ctx) => {
            if (await this.repo.activateOrganization(ctx, id)) {
                if (sendEmail) {
                    await Emails.sendAccountActivatedEmail(ctx, id);
                }
                for (let m of await Store.OrganizationMember.organization.findAll(ctx, 'joined', id)) {
                    await Modules.Users.activateUser(ctx, m.uid, false);
                    let profile = await Store.UserProfile.findById(ctx, m.uid);
                    let org = await Store.Organization.findById(ctx, id);
                    if (profile && !profile.primaryOrganization && (org && org.kind === 'organization')) {
                        profile.primaryOrganization = id;
                    }

                    if (byAdmin) {
                        await Modules.Hooks.onUserActivatedByAdmin(ctx, m.uid);
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
            let [, profile] = await this.getUnsuspendedUserWithProfile(ctx, uid);

            let member = await Store.OrganizationMember.findById(ctx, oid, by);
            let isSuperAdmin = (await Modules.Super.superRole(ctx, by)) === 'super-admin';
            let canAdd = (member && member.status === 'joined') || isSuperAdmin || skipChecks;
            if (!canAdd) {
                throw new AccessDeniedError('Only members can add members');
            }

            // Add member
            if (await this.repo.addUserToOrganization(ctx, uid, oid, by)) {
                let org = (await Store.Organization.findById(ctx, oid))!;
                if (org.status === 'activated') {
                    // Activate user if organization is in activated state
                    await Modules.Users.activateUser(ctx, uid, isNewUser, by);

                    // Find and activate organizations created by user if have one
                    let userOrgs = await Promise.all((await this.findUserOrganizations(ctx, uid)).map(orgId => Store.Organization.findById(ctx, orgId)));
                    userOrgs = userOrgs.filter(o => o!.ownerId === uid);
                    for (let userOrg of userOrgs) {
                        // Activate user organization
                        if (await this.activateOrganization(ctx, userOrg!.id, !isNewUser)) {
                            await Modules.Hooks.onFirstOrganizationActivated(ctx, userOrg!.id, { type: 'OWNER_ADDED_TO_ORG', owner: by, otherOid: oid, uid });
                        }
                    }

                    if (org.kind === 'organization') {
                        // Update primary organization if needed
                        if (!profile.primaryOrganization) {
                            profile.primaryOrganization = oid;
                        }
                    } else if (org.kind === 'community') {
                        if (!profile.primaryOrganization && userOrgs.length > 0) {
                            profile.primaryOrganization = await this.repo.findPrimaryOrganizationForUser(ctx, uid);
                        }
                    }
                }
                return org;
            }

            return await Store.Organization.findById(ctx, oid);
        });
    }

    private async getUnsuspendedUserWithProfile(ctx: Context, uid: number): Promise<[User, UserProfile]> {
        let user = await Store.User.findById(ctx, uid);
        if (!user) {
            throw Error('Unable to find user');
        }
        if (user.status === 'suspended') {
            throw Error('User is suspended');
        }
        let profile = await Store.UserProfile.findById(ctx, uid);
        if (!profile) {
            throw Error('Profile is not created');
        }
        return [user!, profile!];
    }

    async removeUserFromOrganization(parent: Context, uid: number, oid: number, by: number) {
        return await inTx(parent, async (ctx) => {

            // Check current membership state
            let member = await Store.OrganizationMember.findById(ctx, oid, uid);
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
                    if (uid === by) {
                        throw new UserError('You cannot leave your only organization');
                    } else {
                        throw new UserError('You cannot kick user from their only organization');
                    }
                }
            }

            if (await this.repo.removeUserFromOrganization(ctx, uid, oid)) {
                let profile = (await Store.UserProfile.findById(ctx, uid))!;
                if (profile.primaryOrganization === oid) {
                    profile.primaryOrganization = await this.repo.findPrimaryOrganizationForUser(ctx, uid);
                    await profile.flush(ctx);
                }
                let userGroups = await Store.RoomParticipant.active.findAll(ctx, uid);
                for (let group of userGroups) {
                    let conv = await Store.Conversation.findById(ctx, group.cid);
                    if (!conv) {
                        continue;
                    }
                    if (conv.kind === 'room') {
                        let room = await Store.ConversationRoom.findById(ctx, conv.id);
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

    async removeUserFromOrganiaztionWithoutAccessChecks(parent: Context, uid: number, oid: number) {
        return this.repo.removeUserFromOrganization(parent, uid, oid, true);
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

    async organizationMembersCount(ctx: Context, oid: number) {
        return this.repo.organizationMembersCount(ctx, oid);
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

    async findPrimaryOrganizationForUser(ctx: Context, uid: number) {
        return await this.repo.findPrimaryOrganizationForUser(ctx, uid);
    }

    //
    // Deprecated
    //

    async renameOrganization(ctx: Context, id: number, title: string) {
        return this.repo.renameOrganization(ctx, id, title);
    }
}