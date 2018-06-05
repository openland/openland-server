import { DB } from '../tables';
import { ImageRef } from './Media';

export class UserRepository {
    private userCache = new Map<string, number | undefined>();

    async fetchOrganizationMembers(organizationId: number) {
        return await DB.User.findAll({
            where: {
                organizationId: organizationId
            }
        });
    }

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

    async fetchUserAccounts(uid: number): Promise<number[]> {
        let user = await DB.User.findById(uid);
        if (user && user.organizationId) {
            return [user.organizationId!!];
        }
        return [];
    }

    async saveProfile(uid: number, firstName: string, lastName: string | null, photo?: ImageRef | null, phone?: number | null) {
        return await DB.tx(async (tx) => {
            let existing = await DB.UserProfile.find({ where: { userId: uid }, transaction: tx });
            if (!existing) {
                return await DB.UserProfile.create({
                    userId: uid,
                    firstName: firstName,
                    lastName: lastName,
                    picture: photo,
                    phone: phone
                }, { transaction: tx });
            } else {
                existing.firstName = firstName;
                existing.lastName = lastName;
                if (photo !== undefined) {
                    existing.picture = photo;
                }
                if (phone !== undefined) {
                    existing.phone = phone;
                }
                await existing.save({ transaction: tx });
                return existing;
            }
        });
    }
}