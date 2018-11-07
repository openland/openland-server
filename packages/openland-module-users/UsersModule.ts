
import { FDB } from 'openland-module-db/FDB';
import { UserRepository } from './repositories/UsersRepository';
import { userProfileIndexer } from './workers/userProfileIndexer';
import { UserSearch } from './search/UserSearch';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { ImageRef } from 'openland-module-media/ImageRef';

export class UsersModule {

    private readonly repo = new UserRepository(FDB);
    private readonly search = new UserSearch();

    start = () => {
        if (serverRoleEnabled('workers')) {
            userProfileIndexer();
        }
    }

    async profileById(uid: number) {
        return this.repo.findUserProfile(uid);
    }

    async createUserProfile(uid: number, input: {
        firstName: string,
        lastName?: string | null,
        photoRef?: ImageRef | null,
        phone?: string | null,
        email?: string | null,
        website?: string | null,
        about?: string | null,
        location?: string | null
    }) {
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