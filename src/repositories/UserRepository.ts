import { DB } from '../tables';
import { ImageRef } from './Media';

export class UserRepository {
    private userCache = new Map<string, number | undefined>();

    async fetchOrganizationMembers(organizationId: number) {
        let uids = (await DB.OrganizationMember.findAll({
            where: {
                orgId: organizationId
            }
        })).map((v) => v.userId);
        return await DB.User.findAll({
            where: {
                id: { $in: uids }
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
        return (await DB.OrganizationMember.findAll({
            where: {
                userId: uid
            }
        })).map((v) => v.orgId);
    }

    async saveProfile(uid: number, firstName: string, lastName: string | null, photo?: ImageRef | null, phone?: string | null) {
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

    async isMemberOfOrganization(uid: number, orgId: number): Promise<boolean> {
        let isMember = await DB.OrganizationMember.findOne({
            where: {
                userId: uid,
                orgId: orgId
            }
        });

        return !!isMember;
    }
}