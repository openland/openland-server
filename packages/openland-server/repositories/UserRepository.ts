import { CallContext } from '../api/utils/CallContext';
import { Repos } from '.';
import { Modules } from 'openland-modules/Modules';
import { UserProfile, User } from 'openland-module-db/schema';
import { FDB } from 'openland-module-db/FDB';
import { ImageRef } from 'openland-module-media/ImageRef';

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
    }, isBot: boolean = false) {
        let user = await FDB.User.findById(uid);
        if (!user) {
            throw Error('Unable to find user');
        }

        await Modules.Users.createUserProfile(uid, input);

        if (!isBot && user.status === 'activated') {
            await Repos.Chats.addToInitialChannel(uid);
        }

        return user;
    }

    async fetchOrganizationMembers(organizationId: number) {
        return (await Promise.all((await FDB.OrganizationMember.allFromOrganization('joined', organizationId))
            .map((v) => FDB.User.findById(v.uid))))
            .map((v) => v!);
    }

    async fetchUserByAuthId(authId: string): Promise<number | undefined> {
        if (this.userCache.has(authId)) {
            return this.userCache.get(authId);
        } else {
            let exists = (await FDB.User.findAll()).find((v) => v.authId === authId);
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
        return orgId ? FDB.Organization.findById(orgId) : undefined;
    }

    async isMemberOfOrganization(uid: number, orgId: number): Promise<boolean> {
        let isMember = await FDB.OrganizationMember.findById(orgId, uid);

        return !!(isMember && isMember.status === 'joined');
    }

    async isUserOnline(uid: number): Promise<boolean> {
        return await Modules.Presence.getLastSeen(uid) === 'online';
    }

    async getUserInvitedBy(uid: number) {
        let user = await FDB.User.findById(uid);
        if (user && user.invitedBy) {
            return await FDB.User.findById(user.invitedBy);
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