import { Modules } from 'openland-modules/Modules';
import { FDB } from 'openland-module-db/FDB';
import { OrganizationMember } from 'openland-module-db/schema';

async function resolveRoleInOrganization(members: OrganizationMember[]): Promise<string[]> {
    let roles: string[] = [];

    for (let member of members) {
        if (member.role === 'admin') {
            roles.push(`OWNER`);
        } else {
            roles.push(`MEMBER`);
        }
    }

    return roles;
}

export async function resolveOrganizationJoinedMembers(orgId: number) {
    let members = await Modules.Orgs.findOrganizationMembership(orgId);

    let roles = await resolveRoleInOrganization(members);

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