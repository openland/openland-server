
import { FDB } from 'openland-module-db/FDB';
import { UserRepository } from './repositories/UsersRepository';
export class UsersModule {
    
    private readonly repo = new UserRepository(FDB);
    
    start = () => {
        // Nothing to do
    }

    async findProfilePrefill(uid: number) {
        return this.repo.findProfilePrefill(uid);
    }

    async saveProfilePrefill(uid: number, prefill: { firstName?: string, lastName?: string, picture?: string }) {
        return this.repo.saveProfilePrefill(uid, prefill);
    }
}