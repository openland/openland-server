import { inTx } from '@openland/foundationdb';
import { AllEntities, OrganizationMember } from 'openland-module-db/schema';
import { Sanitizer } from 'openland-utils/Sanitizer';
import { OrganizatinProfileInput } from 'openland-module-organization/OrganizationProfileInput';
import { validate, stringNotEmpty } from 'openland-utils/NewInputValidator';
import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';
import { UserError } from '../../openland-errors/UserError';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { Modules } from '../../openland-modules/Modules';
import { lazyInject } from '../../openland-modules/Modules.container';
import { FDB } from '../../openland-module-db/FDB';

@injectable()
export class OrganizationRepository {
    @lazyInject('FDB')
    private readonly entities!: AllEntities;

    async createOrganization(parent: Context, uid: number, input: OrganizatinProfileInput, opts: { editorial: boolean, status: 'activated' | 'pending' | 'suspended' }) {
        await validate(
            stringNotEmpty('Name can\'t be empty!'),
            input.name,
            'input.name'
        );

        return await inTx(parent, async (ctx) => {

            // Fetch Organization Number
            let seq = (await this.entities.Sequence.findById(ctx, 'org-id'));
            if (!seq) {
                seq = await this.entities.Sequence.create(ctx, 'org-id', { value: 0 });
            }
            let orgId = ++seq.value;
            await seq.flush(ctx);

            let organization;

            // if (input.id) {
            //     // find organization
            //     organization = await this.entities.Organization.findById(ctx, IDs.Organization.parse(input.id));
            //
            //     if (!organization) {
            //         throw Error(`Did not found organization with id ${input.id}`);
            //     }
            //
            //     await this.addUserToOrganization(ctx, uid, organization.id, null);
            //     let profile = await FDB.UserProfile.findById(ctx, uid);
            //     if (!profile) {
            //         throw Error(`User ${uid} does not have profile`);
            //     }
            //     profile.primaryOrganization = organization.id;
            // } else {
                // Create organization
                organization = await this.entities.Organization.create(ctx, orgId, {
                    kind: input.isCommunity ? 'community' : 'organization',
                    ownerId: uid,
                    status: opts.status,
                    editorial: opts.editorial,
                    private: input.isCommunity && input.isPrivate,
                    personal: input.personal
                });

                // Create organization profile
                await this.entities.OrganizationProfile.create(ctx, orgId, {
                    name: Sanitizer.sanitizeString(input.name)!,
                    website: Sanitizer.sanitizeString(input.website),
                    photo: Sanitizer.sanitizeImageRef(input.photoRef),
                    about: Sanitizer.sanitizeString(input.about)
                });

                // Create editorial data
                await this.entities.OrganizationEditorial.create(ctx, orgId, {
                    listed: true,
                    featured: false
                });

                // Add owner to organization
                await this.entities.OrganizationMember.create(ctx, organization.id, uid, {
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
            let org = (await this.entities.Organization.findById(ctx, id))!;
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
            let org = (await this.entities.Organization.findById(ctx, id))!;
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
            let org = await this.entities.Organization.findById(ctx, oid);
            if (!org) {
                throw Error('Unable to find organization');
            }
            let ex = await this.entities.OrganizationMember.findById(ctx, oid, uid);
            if (ex && ex.status === 'joined') {
                return false;
            } else if (ex) {
                ex.status = 'joined';
                await this.incrementOrganizationMembersCount(ctx, oid);
                return true;
            } else {
                await this.entities.OrganizationMember.create(ctx, oid, uid, { status: 'joined', role: 'member', invitedBy: by });
                await this.incrementOrganizationMembersCount(ctx, oid);
                return true;
            }
        });
    }

    async removeUserFromOrganization(parent: Context, uid: number, oid: number) {
        return await inTx(parent, async (ctx) => {
            let org = await this.entities.Organization.findById(ctx, oid);
            if (!org) {
                throw Error('Unable to find organization');
            }
            if (await this.isUserOwner(ctx, uid, oid)) {
                throw Error('Unable to remove owner');
            }

            let existing = await this.entities.OrganizationMember.findById(ctx, oid, uid);
            if (!existing || existing.status !== 'joined') {
                return false;
            }
            existing.status = 'left';
            existing.role = 'member'; // Downgrade membership
            await existing.flush(ctx);
            await this.decrementOrganizationMembersCount(ctx, oid);
            return true;
        });
    }

    async updateMembershipRole(parent: Context, uid: number, oid: number, role: 'admin' | 'member') {
        return await inTx(parent, async (ctx) => {
            let member = await this.entities.OrganizationMember.findById(ctx, oid, uid);
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
            let organization = await this.entities.Organization.findById(ctx, oid);

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

            let chats = await FDB.ConversationRoom.allFromOrganizationPublicRooms(ctx, oid);

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

            // Change primary organization to other one
            userProfile.primaryOrganization = userOrganizations.filter(o => o !== oid)[0];

            await this.markForUndexing(ctx, oid);

            return true;
        });
    }

    //
    // Permissions
    //

    async isUserMember(ctx: Context, uid: number, oid: number): Promise<boolean> {
        let isMember = await this.entities.OrganizationMember.findById(ctx, oid, uid);
        return !!(isMember && isMember.status === 'joined');
    }

    async isUserAdmin(ctx: Context, uid: number, oid: number): Promise<boolean> {
        let isOwner = await this.entities.OrganizationMember.findById(ctx, oid, uid);
        return !!(isOwner && isOwner.status === 'joined' && isOwner.role === 'admin');
    }

    async isUserOwner(ctx: Context, uid: number, oid: number): Promise<boolean> {
        let org = await this.entities.Organization.findById(ctx, oid);
        return !!(org && org.ownerId === uid);
    }

    //
    // Queries
    //

    async findOrganizationMembership(ctx: Context, oid: number) {
        return await this.entities.OrganizationMember.allFromOrganization(ctx, 'joined', oid);
    }

    async findOrganizationMembersWithStatus(ctx: Context, oid: number, status: 'requested' | 'joined' | 'left') {
        return await this.entities.OrganizationMember.allFromOrganization(ctx, status, oid);
    }

    async findOrganizationMembers(ctx: Context, oid: number) {
        return (await Promise.all((await this.findOrganizationMembership(ctx, oid))
            .map((v) => this.entities.User.findById(ctx, v.uid))))
            .map((v) => v!);
    }

    async organizationMembersCount(ctx: Context, oid: number): Promise<number> {
        return ((await FDB.OrganizationProfile.findById(ctx, oid))!.joinedMembersCount || 0);
    }

    async findUserOrganizations(ctx: Context, uid: number): Promise<number[]> {
        return (await this.entities.OrganizationMember.allFromUser(ctx, 'joined', uid)).map((v) => v.oid);
    }

    async findUserMembership(ctx: Context, uid: number, oid: number): Promise<OrganizationMember | null> {
        return await this.entities.OrganizationMember.findById(ctx, oid, uid);
    }

    async hasMemberWithEmail(ctx: Context, oid: number, email: string): Promise<boolean> {
        return !!(await this.findOrganizationMembers(ctx, oid))
            .find((v) => v!.email === email);
    }

    async findPrimaryOrganizationForUser(ctx: Context, uid: number): Promise<number | null> {
        let userOrgs = await this.findUserOrganizations(ctx, uid);
        let primaryOrganization: number | null = null;
        for (let oid of userOrgs) {
            let org = await this.entities.Organization.findById(ctx, oid);
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
            let existing = await this.entities.OrganizationIndexingQueue.findById(ctx, oid);
            if (existing) {
                existing.markDirty();
            } else {
                await this.entities.OrganizationIndexingQueue.create(ctx, oid, {});
            }
        });
    }

    //
    // Deprecated
    //

    async renameOrganization(parent: Context, id: number, title: string) {
        return await inTx(parent, async (ctx) => {
            let org = await this.entities.Organization.findById(ctx, id);
            let profile = await this.entities.OrganizationProfile.findById(ctx, id);
            profile!.name = title;
            return org;
        });
    }

    private incrementOrganizationMembersCount(parent: Context, oid: number) {
        return inTx(parent, async ctx => {
           let profile = await this.entities.OrganizationProfile.findById(ctx, oid);
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
            let profile = await this.entities.OrganizationProfile.findById(ctx, oid);
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