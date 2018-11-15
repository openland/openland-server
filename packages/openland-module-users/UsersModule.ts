
import { FDB } from 'openland-module-db/FDB';
import { UserRepository } from './repositories/UsersRepository';
import { userProfileIndexer } from './workers/userProfileIndexer';
import { UserSearch } from './search/UserSearch';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { ProfileInput } from './ProfileInput';
import { injectable } from 'inversify';
import { inTx } from 'foundation-orm/inTx';
import { Emails } from 'openland-module-email/Emails';
import { ImageRef } from 'openland-module-media/ImageRef';
import { Context } from 'openland-utils/Context';

@injectable()
export class UsersModule {

    private readonly repo = new UserRepository(FDB);
    private readonly search = new UserSearch();

    start = () => {
        if (serverRoleEnabled('workers')) {
            userProfileIndexer();
        }
    }

    async createUser(ctx: Context, authId: string, email: string) {
        return this.repo.createUser(ctx, authId, email);
    }

    async activateUser(ctx: Context, uid: number) {
        await inTx(async () => {
            if (await this.repo.activateUser(ctx, uid)) {
                await Emails.sendWelcomeEmail(ctx, uid);
            }
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

    async searchForUsers(ctx: Context, query: string, options?: { uid?: number, limit?: number }) {
        return await this.search.searchForUsers(ctx, query, options);
    }
}