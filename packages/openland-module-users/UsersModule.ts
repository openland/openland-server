
import { FDB } from 'openland-module-db/FDB';
import { UserRepository } from './repositories/UsersRepository';
import { userProfileIndexer } from './workers/userProfileIndexer';
import { UserSearch } from './search/UserSearch';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { ProfileInput } from './ProfileInput';
import { injectable } from 'inversify';
import { inTx } from 'foundation-orm/inTx';

@injectable()
export class UsersModule {

    private readonly repo = new UserRepository(FDB);
    private readonly search = new UserSearch();

    start = () => {
        if (serverRoleEnabled('workers')) {
            userProfileIndexer();
        }
    }

    async createUser(authId: string, email: string) {
        return this.repo.createUser(authId, email);
    }

    async activateUser(uid: number) {
        await inTx(async () => {
            if (await this.repo.activateUser(uid)) {
                // TODO: Send email
            }
        });
    }

    async profileById(uid: number) {
        return this.repo.findUserProfile(uid);
    }

    async findUserByAuthId(authId: string): Promise<number | undefined> {
        return this.repo.findUserByAuthId(authId);
    }

    async createUserProfile(uid: number, input: ProfileInput) {
        return await this.repo.createUserProfile(uid, input);
    }

    async findProfilePrefill(uid: number) {
        return this.repo.findProfilePrefill(uid);
    }

    async saveProfilePrefill(uid: number, prefill: { firstName?: string, lastName?: string, picture?: string }) {
        return this.repo.saveProfilePrefill(uid, prefill);
    }

    async getUserSettings(uid: number) {
        return await this.repo.getUserSettings(uid);
    }

    async waitForNextSettings(uid: number) {
        await this.repo.waitForNextSettings(uid);
    }

    async searchForUsers(query: string, options?: { uid?: number, limit?: number }) {
        return await this.search.searchForUsers(query, options);
    }
}