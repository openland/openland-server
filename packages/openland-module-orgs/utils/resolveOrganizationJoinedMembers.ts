import { Modules } from 'openland-modules/Modules';
import { Repos } from 'openland-server/repositories';
import { FDB } from 'openland-module-db/FDB';

export async function resolveOrganizationJoinedMembers(orgId: number) {
    let members = await Modules.Orgs.findOrganizationMembership(orgId);

    let roles = await Repos.Permissions.resolveRoleInOrganization(members);

    let result: any[] = [];

    for (let i = 0; i < members.length; i++) {
        let member = (await FDB.User.findById(members[i].uid))!;
        result.push({
            _type: 'OrganizationJoinedMember',
            user: member,
            joinedAt: members[i].createdAt,
            email: member.email,
            showInContacts: false,
            role: roles[i]
        });
    }

    return result;
}