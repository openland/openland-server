import { DB, User } from '../tables';
import DataLoader from 'dataloader';
import { CallContext } from '../api/utils/CallContext';
import { ImageRef } from './Media';

export class UserRepository {
    private userCache = new Map<string, number | undefined>();

    userLoader(context: CallContext) {
        if (!context.cache.has('__user_loader')) {
            context.cache.set('__user_loader', new DataLoader<number, User | null>(async (ids) => {
                let foundTokens = await DB.User.findAll({
                    where: {
                        id: {
                            $in: ids
                        }
                    }
                });

                let res: (User | null)[] = [];
                for (let i of ids) {
                    let found = false;
                    for (let f of foundTokens) {
                        if (i === f.id) {
                            res.push(f);
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        res.push(null);
                    }
                }
                return res;
            }));
        }
        let loader = context.cache.get('__user_loader') as DataLoader<number, User | null>;
        return loader;
    }

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

    async markUserOnline(uid: number, timeout: number, tokenId: number) {
        let now = new Date();
        let expires = new Date(now.getTime() + timeout);
        await DB.txStable(async (tx) => {
            let existing = await DB.UserPresence.find({
                where: { userId: uid, tokenId: tokenId },
                transaction: tx,
                lock: tx.LOCK.UPDATE
            });
            if (existing) {
                existing.lastSeen = now;
                existing.lastSeenTimeout = expires;
                await existing.save({ transaction: tx });
            } else {
                await DB.UserPresence.create({
                    userId: uid,
                    tokenId: tokenId,
                    lastSeen: now,
                    lastSeenTimeout: expires
                }, { transaction: tx });
            }
        });
    }
}