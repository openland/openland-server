import { AuthInfo } from './repositories/UserRepository';
import { userProfileIndexer } from './workers/userProfileIndexer';
import { UserSearch } from './search/UserSearch';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { ProfileInput } from './ProfileInput';
import { injectable, inject } from 'inversify';
import { ImageRef } from 'openland-module-media/ImageRef';
import { Context, createNamedContext } from '@openland/context';
import { NotFoundError } from '../openland-errors/NotFoundError';
import { Modules } from '../openland-modules/Modules';
import { AudienceCounterRepository } from './repositories/AudienceCounterRepository';
import { declareUserAudienceCalculator } from './workers/userAudienceCalculator';
import { createLogger } from '@openland/log';
import { badgeIndexer } from './workers/badgeIndexer';
import { ModernBadgeMediator } from './mediators/ModernBadgeMediator';
import { UserMediator } from './mediators/UserMediator';
import { UserSettingsShape } from 'openland-module-db/store';
import { inReadOnlyTx } from '@openland/foundationdb';

const rootCtx = createNamedContext('users_module');
const log = createLogger('users_module');

export type UserSettingsSnapshot = UserSettingsShape & { version: number };

@injectable()
export class UsersModule {
    private readonly users: UserMediator;
    private readonly audienceCounterRepo: AudienceCounterRepository;

    public readonly badges: ModernBadgeMediator;
    public readonly search = new UserSearch();
    private deletedUserId: number | null = null;

    constructor(
        @inject('UserMediator') users: UserMediator,
        @inject('AudienceCounterRepository') audienceCounterRepo: AudienceCounterRepository,
        @inject('ModernBadgeMediator') badges: ModernBadgeMediator,
    ) {
        this.users = users;
        this.audienceCounterRepo = audienceCounterRepo;
        this.badges = badges;
    }

    start = async () => {
        if (serverRoleEnabled('workers')) {
            userProfileIndexer();
            badgeIndexer();

            declareUserAudienceCalculator();
        }

        this.deletedUserId = await inReadOnlyTx(rootCtx, async (ctx) => Modules.Super.getEnvVar<number>(ctx, 'deleted-user-id'));

        if (!this.deletedUserId) {
            log.warn(rootCtx, 'deleted-user-id is not set');
        }
    }

    async createUser(ctx: Context, authInfo: AuthInfo) {
        return await this.users.createUser(ctx, authInfo);
    }

    async deleteUser(ctx: Context, uid: number) {
        return await this.users.deleteUser(ctx, uid);
    }

    async profileById(ctx: Context, uid: number) {
        return this.users.findUserProfile(ctx, uid);
    }

    async findUserByAuthId(ctx: Context, authId: string): Promise<number | undefined> {
        return this.users.findUserByAuthId(ctx, authId);
    }

    async createSystemBot(ctx: Context, key: string, name: string, photoRef: ImageRef) {
        return await this.users.createSystemBot(ctx, key, name, photoRef);
    }

    async createTestUser(ctx: Context, key: string, name: string) {
        return await this.users.createTestUser(ctx, key, name);
    }

    async createUserProfile(ctx: Context, uid: number, input: ProfileInput) {
        return await this.users.createUserProfile(ctx, uid, input);
    }

    async updateUserProfile(ctx: Context, uid: number, input: ProfileInput) {
        return await this.users.updateUserProfile(ctx, uid, input);
    }

    async userBindInvitedBy(ctx: Context, uid: number, inviteKey: string) {
        return await this.users.bindInvitedBy(ctx, uid, inviteKey);
    }

    async findProfilePrefill(ctx: Context, uid: number) {
        return this.users.findProfilePrefill(ctx, uid);
    }

    async saveProfilePrefill(ctx: Context, uid: number, prefill: { firstName?: string, lastName?: string, picture?: string }) {
        return this.users.saveProfilePrefill(ctx, uid, prefill);
    }

    async getUserSettings(ctx: Context, uid: number) {
        return await this.users.getUserSettings(ctx, uid);
    }

    async getUserSettingsEntity(ctx: Context, uid: number) {
        return await this.users.getUserSettingsEntity(ctx, uid);
    }

    async notifyUserSettingsChanged(parent: Context, uid: number) {
        return await this.users.notifyUserSettingsChanged(parent, uid);
    }

    async waitForNextSettings(ctx: Context, uid: number) {
        await this.users.waitForNextSettings(ctx, uid);
    }

    async searchForUsers(ctx: Context, query: string, options?: { uid?: number, limit?: number, after?: string, page?: number, byName?: boolean, uids?: number[], hashtags?: string[] }) {
        return await this.search.searchForUsers(ctx, query, options);
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

    async markForIndexing(ctx: Context, uid: number) {
        return this.users.markForIndexing(ctx, uid);
    }

    async getSupportUserId(ctx: Context) {
        return await Modules.Super.getEnvVar<number>(ctx, 'support-user-id');
    }

    async isTest(ctx: Context, uid: number) {
        return await this.users.isTest(ctx, uid);
    }

    getDeletedUserId() {
        return this.deletedUserId;
    }

    async onChatMembersCountChange(ctx: Context, cid: number, delta: number) {
        return await this.audienceCounterRepo.addToCalculatingQueue(ctx, cid, delta);
    }
}
