import { DB } from '../tables';

export interface AvatarUpload {
    uploadId: string;
    cropX: number;
    cropY: number;
    cropW: number;
    cropH: number;
}

export class UserRepository {
    private userCache = new Map<string, number | undefined>();

    async fetchOrganizationMembers(organizationId: number) {
        return await DB.User.findAll({
            where: {
                organizationId: organizationId
            },
            order: ['firstName', 'lastName']
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

    async saveProfile(uid: number, firstName: string, lastName: string | null, photo: AvatarUpload | null) {
        return await DB.tx(async (tx) => {
            let existing = await DB.UserProfile.find({ where: { userId: uid }, transaction: tx });
            if (!existing) {
                return await DB.UserProfile.create({
                    userId: uid,
                    firstName: firstName,
                    lastName: lastName,
                }, { transaction: tx });
            } else {
                existing.firstName = firstName;
                existing.lastName = lastName;
                await existing.save({ transaction: tx });
                return existing;
            }
        });
    }
}