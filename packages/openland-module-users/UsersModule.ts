
import { FDB } from 'openland-module-db/FDB';
import { UserRepository } from './repositories/UsersRepository';
import { ImageRef } from 'openland-server/repositories/Media';
import { User } from 'openland-server/tables';
export class UsersModule {

    private readonly repo = new UserRepository(FDB);

    start = () => {
        // Nothing to do
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

    async profileById(uid: number) {
        return this.repo.findUserProfile(uid);
    }
}