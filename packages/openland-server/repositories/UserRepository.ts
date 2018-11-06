import { DB, User } from '../tables';
import DataLoader from 'dataloader';
import { CallContext } from '../api/utils/CallContext';
import { ImageRef } from './Media';
import { Transaction } from 'sequelize';
import { Repos } from '.';
import { Modules } from 'openland-modules/Modules';
import { UserProfile } from 'openland-module-db/schema';
import { FDB } from 'openland-module-db/FDB';

export class UserRepository {
    private readonly userCache = new Map<string, number | undefined>();

    async createUser(uid: number, input: {
        firstName: string,
        lastName?: string | null,
        photoRef?: ImageRef | null,
        phone?: string | null,
        email?: string | null,
        website?: string | null,
        about?: string | null,
        location?: string | null
    }, tx: Transaction, isBot: boolean = false) {
        let user = await DB.User.findById(uid, { transaction: tx });
        if (!user) {
            throw Error('Unable to find user');
        }

        await Modules.Users.createUserProfile(user, input);

        if (!isBot && user.status === 'ACTIVATED') {
            await Repos.Chats.addToInitialChannel(user.id!!, tx);
        }

        return user;
    }

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
        let uids = (await FDB.OrganizationMember.allFromOrganization('joined', organizationId)).map((v) => v.uid);
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
        return (await FDB.OrganizationMember.allFromUser('joined', uid)).map((v) => v.oid);
    }

    async loadPrimatyOrganization(context: CallContext, profile: UserProfile | null, src: User) {
        let orgId = (profile && profile.primaryOrganization) || (await Repos.Users.fetchUserAccounts(src.id!))[0];
        return orgId ? Repos.Organizations.organizationLoader(context).load(orgId) : undefined;
    }

    async isMemberOfOrganization(uid: number, orgId: number): Promise<boolean> {
        let isMember = await FDB.OrganizationMember.findById(orgId, uid);

        return !!(isMember && isMember.status === 'joined');
    }

    async isUserOnline(uid: number): Promise<boolean> {
        return await Modules.Presence.getLastSeen(uid) === 'online';
    }

    async getUserInvitedBy(uid: number) {
        let user = await DB.User.findOne({ where: { id: uid } });
        if (user && user.invitedBy) {
            return await DB.User.findOne({ where: { id: user.invitedBy } });
        }
        return null;
    }

    async getUserLastIp(uid: number) {

        // let lastActiveToken = await DB.UserToken.findAll({
        //     where: {
        //         userId: uid
        //     },
        //     order: [['updatedAt', 'DESC']],
        //     limit: 1
        // });

        // if (!lastActiveToken[0]) {
        //     return null;
        // }

        // return lastActiveToken[0].lastIp || null;
        return null;
    }
}