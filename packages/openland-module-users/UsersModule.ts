
import { UserRepository } from './repositories/UserRepository';
import { userProfileIndexer } from './workers/userProfileIndexer';
import { UserSearch } from './search/UserSearch';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { ProfileInput } from './ProfileInput';
import { injectable, inject } from 'inversify';
import { inTx } from '@openland/foundationdb';
import { Emails } from 'openland-module-email/Emails';
import { ImageRef } from 'openland-module-media/ImageRef';
import { Context } from '@openland/context';
import { NotFoundError } from '../openland-errors/NotFoundError';
import { Modules } from '../openland-modules/Modules';
import { AudienceCounterRepository } from './repositories/AudienceCounterRepository';
import { declareUserAudienceCalculator } from './workers/userAudienceCalculator';

@injectable()
export class UsersModule {
    private readonly repo: UserRepository;
    private readonly audienceCounterRepo: AudienceCounterRepository;
    public readonly search = new UserSearch();

    constructor(
        @inject('UserRepository') userRepo: UserRepository,
        @inject('AudienceCounterRepository') audienceCounterRepo: AudienceCounterRepository
    ) {
        this.repo = userRepo;
        this.audienceCounterRepo = audienceCounterRepo;
    }

    start = () => {
        if (serverRoleEnabled('workers')) {
            userProfileIndexer();
            declareUserAudienceCalculator();
        }
    }

    async createUser(ctx: Context, authId: string, email: string) {
        return this.repo.createUser(ctx, authId, email);
    }

    async activateUser(parent: Context, uid: number, sendEmail: boolean, invitedBy: number | null = null) {
        await inTx(parent, async (ctx) => {
            if (await this.repo.activateUser(ctx, uid, invitedBy)) {
                if (sendEmail) {
                    await Emails.sendWelcomeEmail(ctx, uid);
                }
                await Modules.Hooks.onUserActivated(ctx, uid);
            }
        });
    }

    async deleteUser(parent: Context, uid: number) {
        await inTx(parent, async (ctx) => {
            return await this.repo.deleteUser(ctx, uid);
        });
    }

    async profileById(ctx: Context, uid: number) {
        return this.repo.findUserProfile(ctx, uid);
    }

    async findUserByAuthId(ctx: Context, authId: string): Promise<number | undefined> {
        return this.repo.findUserByAuthId(ctx, authId);
    }

    async createSystemBot(ctx: Context, key: string, name: string, photoRef: ImageRef) {
        return await this.repo.createSystemBot(ctx, key, name, photoRef);
    }

    async createTestUser(ctx: Context, key: string, name: string) {
        return await this.repo.createTestUser(ctx, key, name);
    }

    async createUserProfile(ctx: Context, uid: number, input: ProfileInput) {
        return await this.repo.createUserProfile(ctx, uid, input);
    }

    async findProfilePrefill(ctx: Context, uid: number) {
        return this.repo.findProfilePrefill(ctx, uid);
    }

    async saveProfilePrefill(ctx: Context, uid: number, prefill: { firstName?: string, lastName?: string, picture?: string }) {
        return this.repo.saveProfilePrefill(ctx, uid, prefill);
    }

    async getUserSettings(ctx: Context, uid: number) {
        return await this.repo.getUserSettings(ctx, uid);
    }

    async waitForNextSettings(ctx: Context, uid: number) {
        await this.repo.waitForNextSettings(ctx, uid);
    }

    async searchForUsers(ctx: Context, query: string, options?: { uid?: number, limit?: number, after?: string, page?: number, byName?: boolean, uids?: number[] }) {
        return await this.search.searchForUsers(ctx, query, options);
    }

    // Badges

    async createBadge(ctx: Context, uid: number, name: string, isSuper: boolean, cid?: number) {
        return await this.repo.createBadge(ctx, uid, name, isSuper, cid);
    }

    async deleteBadge(ctx: Context, uid: number, bid: number) {
        return await this.repo.deleteBadge(ctx, uid, bid);
    }

    async updatePrimaryBadge(ctx: Context, uid: number, bid: number | null) {
        return await this.repo.updatePrimaryBadge(ctx, uid, bid);
    }

    async verifyBadge(ctx: Context, bid: number, by: number | null) {
        return await this.repo.verifyBadge(ctx, bid, by);
    }

    async updateRoomBage(ctx: Context, uid: number, cid: number, bid: number | null) {
        return await this.repo.updateRoomBadge(ctx, uid, cid, bid);
    }

    async getUserBadge(ctx: Context, uid: number, cid?: number, ignorePrimary?: boolean) {
        return await this.repo.getUserBadge(ctx, uid, cid, true);
    }

    async getUserFullName(ctx: Context, uid: number) {
        let profile = await this.profileById(ctx, uid);

        if (!profile) {
            throw new NotFoundError();
        }

        if (profile.lastName) {
            return profile.firstName + ' ' + profile.lastName;
        } else {
            return profile.firstName;
        }
    }

    async isTest(ctx: Context, uid: number) {
        let user = await this.repo.findUser(ctx, uid);
        return user ? user.email.endsWith('maildu.de') : false;
    }

    async markForUndexing(ctx: Context, uid: number) {
        return this.repo.markForUndexing(ctx, uid);
    }

    async getSupportUserId(ctx: Context) {
        return await Modules.Super.getEnvVar<number>(ctx, 'support-user-id');
    }

    async getDeletedUserId(ctx: Context) {
        return await Modules.Super.getEnvVar<number>(ctx, 'deleted-user-id');
    }

    async onChatMembersCountChange(ctx: Context, cid: number, delta: number) {
        return await this.audienceCounterRepo.addToCalculatingQueue(ctx, cid, delta);
    }


}