import { Repos } from '.';
import { UserProfile, User } from 'openland-module-db/schema';
import { FDB } from 'openland-module-db/FDB';

export class UserRepository {

    async fetchOrganizationMembers(organizationId: number) {
        return (await Promise.all((await FDB.OrganizationMember.allFromOrganization('joined', organizationId))
            .map((v) => FDB.User.findById(v.uid))))
            .map((v) => v!);
    }

    async fetchUserAccounts(uid: number): Promise<number[]> {
        return (await FDB.OrganizationMember.allFromUser('joined', uid)).map((v) => v.oid);
    }

    async loadPrimatyOrganization(profile: UserProfile | null, src: User) {
        let orgId = (profile && profile.primaryOrganization) || (await Repos.Users.fetchUserAccounts(src.id!))[0];
        return orgId ? FDB.Organization.findById(orgId) : undefined;
    }

    async isMemberOfOrganization(uid: number, orgId: number): Promise<boolean> {
        let isMember = await FDB.OrganizationMember.findById(orgId, uid);

        return !!(isMember && isMember.status === 'joined');
    }

    async getUserInvitedBy(uid: number) {
        let user = await FDB.User.findById(uid);
        if (user && user.invitedBy) {
            return await FDB.User.findById(user.invitedBy);
        }
        return null;
    }
}