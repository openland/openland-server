import { DB } from '../tables';

export class UserRepository {
    private userCache = new Map<string, number | undefined>();

    async fetchUserByAuthId(authId: string): Promise<number | undefined> {
        if (this.userCache.has(authId)) {
            return this.userCache.get(authId);
        } else {
            let exists = await DB.User.find({
                where: {
                    authId: authId
                }
            });
            if (exists != null) {
                if (!this.userCache.has(authId)) {
                    this.userCache.set(authId, exists.id!!);
                }
                return exists.id;
            } else {
                if (!this.userCache.has(authId)) {
                    this.userCache.set(authId, undefined);
                }
                return undefined;
            }
        }
    }
}