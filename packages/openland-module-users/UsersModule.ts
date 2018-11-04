
import { FDB } from 'openland-module-db/FDB';
import { UserRepository } from './repositories/UsersRepository';
import { ImageRef } from 'openland-server/repositories/Media';
import { User } from 'openland-server/tables';
import { userProfileIndexer } from './workers/userProfileIndexer';
import { UserSearch } from './search/UserSearch';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { startMigrator } from './Migrator';

export class UsersModule {

    private readonly repo = new UserRepository(FDB);
    private readonly search = new UserSearch();

    start = () => {
        if (serverRoleEnabled('workers')) {
            userProfileIndexer();
            startMigrator();
        }
    }

    async profileById(uid: number) {
        return this.repo.findUserProfile(uid);
    }

    async createUserProfile(user: User, input: {
        firstName: string,
        lastName?: string | null,
        photoRef?: ImageRef | null,
        phone?: string | null,
        email?: string | null,
        website?: string | null,
        about?: string | null,
        location?: string | null
    }) {
        return await this.repo.createUserProfile(user, input);
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