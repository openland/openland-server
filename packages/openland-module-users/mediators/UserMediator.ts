import { injectable } from 'inversify';
import { lazyInject } from 'openland-modules/Modules.container';
import { AuthInfo, UserRepository } from '../repositories/UserRepository';
import { Context } from '@openland/context';
import { inTx, transactional } from '@openland/foundationdb';
import { Store } from '../../openland-module-db/FDB';
import { NotFoundError } from '../../openland-errors/NotFoundError';
import { Modules } from '../../openland-modules/Modules';
import { ProfileInput } from '../ProfileInput';
import { ImageRef } from '../../openland-module-media/ImageRef';
import { Emails } from '../../openland-module-email/Emails';
import { AccessDeniedError } from '../../openland-errors/AccessDeniedError';

@injectable()
export class UserMediator {
    @lazyInject('UserRepository')
    private readonly repo!: UserRepository;

    /*
    * Checks
    * */
    async isTest(ctx: Context, uid: number) {
        let user = await this.repo.findUser(ctx, uid);
        if (user && user.email?.endsWith('maildu.de')) {
            return true;
        }
        return false;
    }

    /*
     * User
     */

    @transactional
    async createUser(ctx: Context, authInfo: AuthInfo) {
        let res = await this.repo.createUser(ctx, authInfo);
        // Events.UserCreated.event(ctx, { uid: res.id });
        await Modules.Hooks.onUserCreated(ctx, res.id);
        return res;
    }

    @transactional
    async deleteUser(ctx: Context, uid: number) {
        let res = await this.repo.deleteUser(ctx, uid);

        // Revoke tokens
        await Modules.Auth.revokeUserTokens(ctx, uid);

        // Leave organizations
        let membership = await Store.OrganizationMember.user.findAll(ctx, 'joined', uid);
        await Promise.all(membership.map(m => Modules.Orgs.removeUserFromOrganiaztionWithoutAccessChecks(ctx, uid, m.oid)));

        // Leave chats
        let participates = await Store.RoomParticipant.userActive.findAll(ctx, uid);
        await Promise.all(participates.map(p => Modules.Messaging.room.leaveRoom(ctx, p.cid, uid, false)));

        // Free shortname
        await Modules.Shortnames.freeShortName(ctx, 'user', uid);

        return res;
    }

    async findUser(ctx: Context, uid: number) {
        return this.repo.findUser(ctx, uid);
    }

    /*
     * Profile
     */

    async findUserProfile(ctx: Context, uid: number) {
        return this.repo.findUserProfile(ctx, uid);
    }

    async createUserProfile(parent: Context, uid: number, input: ProfileInput) {
        return await inTx(parent, async (ctx) => {
            let res = this.repo.createUserProfile(ctx, uid, input);

            // Events.UserProfileCreated.event(ctx, { uid: uid });
            await Emails.sendWelcomeEmail(ctx, uid);
            await Modules.Hooks.onUserActivated(ctx, uid);

            return res;
        });
    }

    async updateUserProfile(parent: Context, uid: number, input: ProfileInput) {
        return await inTx(parent, async ctx => {
            if (ctx.auth.uid! !== uid && !(await Modules.Super.isSuperAdmin(ctx, uid))) {
                throw new AccessDeniedError();
            }

            let { profile, nameChanged, photoChanged } = await this.repo.updateUserProfile(ctx, uid, input);
            await Modules.Hooks.onUserProfileUpdated(ctx, profile.id);
            await Modules.Users.markForIndexing(ctx, uid);
            if (nameChanged || photoChanged) {
                await Modules.SocialImageModule.onUserUpdated(ctx, uid);
            }

            return profile;
        });
    }

    async bindInvitedBy(parent: Context, uid: number, inviteKey: string) {
        await inTx(parent, async ctx => {
            let user = await this.repo.findUser(ctx, uid);
            if (!user) {
                throw new NotFoundError('Unable to find user');
            }
            let invite = await Modules.Invites.resolveInvite(ctx, inviteKey);
            if (invite) {
                user.invitedBy = invite.creatorId;
            }
        });
    }

    /*
     * Bots
     */

    async createSystemBot(ctx: Context, key: string, name: string, photoRef: ImageRef) {
        let user = await this.createUser(ctx, { email: 'hello@openland.com' });
        await this.createUserProfile(ctx, user.id, {
            firstName: name,
            photoRef: photoRef,
            email: 'hello@openland.com',
        });
        return user.id;
    }

    async createTestUser(parent: Context, key: string, name: string) {
        return await inTx(parent, async (ctx) => {
            let email = `test-user-${key}@openland.com`;
            let user = await this.createUser(ctx, { email });
            await this.createUserProfile(ctx, user.id, { firstName: name, email });
            return user.id;
        });
    }

    /*
     * User Settings
     */
    @transactional
    async getUserSettings(parent: Context, uid: number) {
        return this.repo.getUserSettings(parent, uid);
    }

    async getUserSettingsEntity(parent: Context, uid: number) {
        return this.repo.getUserSettingsEntity(parent, uid);
    }

    notifyUserSettingsChanged = async (parent: Context, uid: number) => {
        return this.repo.notifyUserSettingsChanged(parent, uid);
    }

    async waitForNextSettings(ctx: Context, uid: number) {
        return this.repo.waitForNextSettings(ctx, uid);
    }

    /*
     * Profile Prefill
     */

    async findProfilePrefill(ctx: Context, uid: number) {
        return this.repo.findProfilePrefill(ctx, uid);
    }

    async saveProfilePrefill(parent: Context, uid: number, prefill: { firstName?: string, lastName?: string, picture?: string }) {
        return this.repo.saveProfilePrefill(parent, uid, prefill);
    }

    /**
     * Queries
     */
    async findUserByAuthId(ctx: Context, authId: string): Promise<number | undefined> {
        return this.repo.findUserByAuthId(ctx, authId);
    }

    //
    // Tools
    //
    async markForIndexing(parent: Context, uid: number) {
        return this.repo.markForIndexing(parent, uid);
    }
}