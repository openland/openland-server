import { inTx } from '@openland/foundationdb';
import { Sanitizer } from 'openland-utils/Sanitizer';
import { OrganizatinProfileInput } from 'openland-module-organization/OrganizationProfileInput';
import { validate, stringNotEmpty } from 'openland-utils/NewInputValidator';
import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { UserError } from '../../openland-errors/UserError';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { Modules } from '../../openland-modules/Modules';
import { Store } from '../../openland-module-db/FDB';
import { OrganizationMember } from 'openland-module-db/store';

@injectable()
export class OrganizationRepository {

    async createOrganization(parent: Context, uid: number, input: OrganizatinProfileInput, opts: { editorial: boolean, status: 'activated' | 'pending' | 'suspended' }) {
        await validate(
            stringNotEmpty('Name can\'t be empty!'),
            input.name,
            'input.name'
        );

        return await inTx(parent, async (ctx) => {
            let isPrivate = (input.isCommunity && input.isPrivate) ? true : false;
            if (!isPrivate && (input.applyLink || input.applyLinkEnabled)) {
                throw new UserError(`Apply link cannot be enabled in public ${input.isCommunity ? 'community' : 'organization'}`);
            }

            // Fetch Organization Number
            let seq = (await Store.Sequence.findById(ctx, 'org-id'));
            if (!seq) {
                seq = await Store.Sequence.create(ctx, 'org-id', { value: 0 });
            }
            let orgId = ++seq.value;
            await seq.flush(ctx);

            // Create organization
            let organization = await Store.Organization.create(ctx, orgId, {
                kind: input.isCommunity ? 'community' : 'organization',
                ownerId: uid,
                status: opts.status,
                editorial: opts.editorial,
                private: isPrivate,
                personal: input.personal ? input.personal : false,
                membersCanInvite: input.membersCanInvite !== undefined ? input.membersCanInvite : true,
                autosubscribeRooms: input.autosubscribeRooms ? input.autosubscribeRooms : [],
            });

            // Create organization profile
            await Store.OrganizationProfile.create(ctx, orgId, {
                name: Sanitizer.sanitizeString(input.name)!,
                website: Sanitizer.sanitizeString(input.website),
                photo: Sanitizer.sanitizeImageRef(input.photoRef),
                socialImage: Sanitizer.sanitizeImageRef(input.socialImageRef),
                about: Sanitizer.sanitizeString(input.about),
                twitter: null,
                facebook: null,
                linkedin: null,
                instagram: null,
                joinedMembersCount: null,
                applyLink: input.applyLink,
                applyLinkEnabled: input.applyLinkEnabled,
            });

            // Create editorial data
            await Store.OrganizationEditorial.create(ctx, orgId, {
                listed: true,
                featured: false
            });

            // Add owner to organization
            await Store.OrganizationMember.create(ctx, organization.id, uid, {
                status: 'joined', role: 'admin', invitedBy: uid
            });
            await this.incrementOrganizationMembersCount(ctx, organization.id);
            // }

            // Mark for indexing
            await this.markForUndexing(ctx, orgId);

            return organization;
        });
    }

    async activateOrganization(parent: Context, id: number) {
        return await inTx(parent, async (ctx) => {
            let org = (await Store.Organization.findById(ctx, id))!;
            if (org.status !== 'activated' && org.status !== 'deleted') {
                org.status = 'activated';
                await org.flush(ctx);
                return true;
            }
            return false;
        });
    }

    async suspendOrganization(parent: Context, id: number) {
        return await inTx(parent, async (ctx) => {
            let org = (await Store.Organization.findById(ctx, id))!;
            if (org.status !== 'suspended') {
                org.status = 'suspended';
                await org.flush(ctx);
                return true;
            } else {
                return false;
            }
        });
    }

    async addUserToOrganization(parent: Context, uid: number, oid: number, by: number | null) {
        return await inTx(parent, async (ctx) => {
            let org = await Store.Organization.findById(ctx, oid);
            if (!org) {
                throw Error('Unable to find organization');
            }
            let ex = await Store.OrganizationMember.findById(ctx, oid, uid);
            if (ex && ex.status === 'joined') {
                return false;
            } else if (ex) {
                ex.status = 'joined';
                await this.incrementOrganizationMembersCount(ctx, oid);
                await Modules.Users.markForIndexing(ctx, uid);
                return true;
            } else {
                await Store.OrganizationMember.create(ctx, oid, uid, { status: 'joined', role: 'member', invitedBy: by });
                await this.incrementOrganizationMembersCount(ctx, oid);
                await Modules.Hooks.onOrgJoin(ctx, oid, uid);
                await Modules.Users.markForIndexing(ctx, uid);
                return true;
            }
        });
    }

    async removeUserFromOrganization(parent: Context, uid: number, oid: number, skipAccessCheck: boolean = false) {
        return await inTx(parent, async (ctx) => {
            let org = await Store.Organization.findById(ctx, oid);
            if (!org) {
                throw Error('Unable to find organization');
            }
            if (!skipAccessCheck && await this.isUserOwner(ctx, uid, oid)) {
                throw Error('Unable to remove owner');
            }

            let existing = await Store.OrganizationMember.findById(ctx, oid, uid);
            if (!existing || existing.status !== 'joined') {
                return false;
            }
            existing.status = 'left';
            existing.role = 'member'; // Downgrade membership
            await existing.flush(ctx);
            await this.decrementOrganizationMembersCount(ctx, oid);
            await Modules.Users.markForIndexing(ctx, uid);
            return true;
        });
    }

    async updateMembershipRole(parent: Context, uid: number, oid: number, role: 'admin' | 'member') {
        return await inTx(parent, async (ctx) => {
            let member = await Store.OrganizationMember.findById(ctx, oid, uid);
            if (!member || member.status !== 'joined') {
                throw Error('User is not a member of organization');
            }
            if (member.role === role) {
                return false;
            }
            member.role = role;
            await member.flush(ctx);
            return true;
        });
    }

    async deleteOrganization(parent: Context, uid: number, oid: number) {
        return await inTx(parent, async (ctx) => {
            let organization = await Store.Organization.findById(ctx, oid);

            if (!organization) {
                throw new NotFoundError();
            }

            if (!await this.isUserAdmin(ctx, uid, oid) && !(await Modules.Super.superRole(ctx, uid) === 'super-admin')) {
                throw new AccessDeniedError();
            }
            let members = await this.findOrganizationMembers(ctx, oid);

            if (members.length > 1) {
                throw new UserError('Organization that has active members cannot be deleted');
            }

            let chats = await Store.ConversationRoom.organizationPublicRooms.findAll(ctx, oid);

            if (chats.length > 0) {
                for (let chat of chats) {
                    if (await Modules.Messaging.roomMembersCount(ctx, chat.id) > 0) {
                        throw new UserError('Organization that has active chat rooms cannot be deleted');
                    }
                }
            }

            let userOrganizations = await this.findUserOrganizations(ctx, uid);

            if (userOrganizations.length === 1) {
                throw new UserError('Can\'t delete your last organization ');
            }

            // Mark deleted
            organization.status = 'deleted';
            await organization.flush(ctx);

            let userProfile = await Modules.Users.profileById(ctx, uid);

            if (!userProfile) {
                throw new NotFoundError();
            }

            await this.removeUserFromOrganization(ctx, uid, oid, true);

            // Change primary organization to other one
            userProfile.primaryOrganization = userOrganizations.filter(o => o !== oid)[0];

            await this.markForUndexing(ctx, oid);

            await Modules.Shortnames.freeShortName(ctx, 'org', oid);

            return true;
        });
    }

    //
    // Permissions
    //

    async isUserMember(ctx: Context, uid: number, oid: number): Promise<boolean> {
        let isMember = await Store.OrganizationMember.findById(ctx, oid, uid);
        return !!(isMember && isMember.status === 'joined');
    }

    async isUserAdmin(ctx: Context, uid: number, oid: number): Promise<boolean> {
        let isOwner = await Store.OrganizationMember.findById(ctx, oid, uid);
        return !!(isOwner && isOwner.status === 'joined' && isOwner.role === 'admin');
    }

    async isUserOwner(ctx: Context, uid: number, oid: number): Promise<boolean> {
        let org = await Store.Organization.findById(ctx, oid);
        return !!(org && org.ownerId === uid);
    }

    //
    // Queries
    //

    async findOrganizationMembership(ctx: Context, oid: number) {
        return await Store.OrganizationMember.organization.findAll(ctx, 'joined', oid);
    }

    async findOrganizationMembersWithStatus(ctx: Context, oid: number, status: 'requested' | 'joined' | 'left') {
        return await Store.OrganizationMember.organization.findAll(ctx, status, oid);
    }

    async findOrganizationMembers(ctx: Context, oid: number) {
        return (await Promise.all((await this.findOrganizationMembership(ctx, oid))
            .map((v) => Store.User.findById(ctx, v.uid))))
            .map((v) => v!);
    }

    async organizationMembersCount(ctx: Context, oid: number): Promise<number> {
        return ((await Store.OrganizationProfile.findById(ctx, oid))!.joinedMembersCount || 0);
    }

    async findUserOrganizations(ctx: Context, uid: number): Promise<number[]> {
        return (await Store.OrganizationMember.user.findAll(ctx, 'joined', uid)).map((v) => v.oid);
    }

    async findUserMembership(ctx: Context, uid: number, oid: number): Promise<OrganizationMember | null> {
        return await Store.OrganizationMember.findById(ctx, oid, uid);
    }

    async hasMemberWithEmail(ctx: Context, oid: number, email: string): Promise<boolean> {
        return !!(await this.findOrganizationMembers(ctx, oid))
            .find((v) => v!.email === email);
    }

    async findPrimaryOrganizationForUser(ctx: Context, uid: number): Promise<number | null> {
        let userOrgs = await this.findUserOrganizations(ctx, uid);
        let primaryOrganization: number | null = null;
        for (let oid of userOrgs) {
            let org = await Store.Organization.findById(ctx, oid);
            if (org && org.kind === 'organization') {
                primaryOrganization = oid;
            }
        }

        return primaryOrganization;
    }

    //
    // Tools
    //
    async markForUndexing(parent: Context, oid: number) {
        await inTx(parent, async (ctx) => {
            let existing = await Store.OrganizationIndexingQueue.findById(ctx, oid);
            if (existing) {
                existing.invalidate();
            } else {
                await Store.OrganizationIndexingQueue.create(ctx, oid, {});
            }
        });
    }

    //
    // Deprecated
    //

    async renameOrganization(parent: Context, id: number, title: string) {
        return await inTx(parent, async (ctx) => {
            let org = await Store.Organization.findById(ctx, id);
            let profile = await Store.OrganizationProfile.findById(ctx, id);
            profile!.name = title;
            return org!;
        });
    }

    private incrementOrganizationMembersCount(parent: Context, oid: number) {
        return inTx(parent, async ctx => {
            let profile = await Store.OrganizationProfile.findById(ctx, oid);
            if (!profile) {
                throw new NotFoundError();
            }

            if (!profile.joinedMembersCount) {
                profile.joinedMembersCount = 1;
            } else {
                profile.joinedMembersCount++;
            }
            await this.markForUndexing(ctx, oid);
        });
    }

    private decrementOrganizationMembersCount(parent: Context, oid: number) {
        return inTx(parent, async ctx => {
            let profile = await Store.OrganizationProfile.findById(ctx, oid);
            if (!profile) {
                throw new NotFoundError();
            }

            if (profile.joinedMembersCount) {
                profile.joinedMembersCount--;
            }
            await this.markForUndexing(ctx, oid);
        });
    }
}
