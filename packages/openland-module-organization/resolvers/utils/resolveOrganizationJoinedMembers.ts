import { Modules } from 'openland-modules/Modules';
import { FDB } from 'openland-module-db/FDB';
import { OrganizationMember } from 'openland-module-db/schema';
import { Context } from 'openland-utils/Context';

async function resolveRoleInOrganization(ctx: Context, oid: number, members: OrganizationMember[]): Promise<string[]> {
    let org = (await FDB.Organization.findById(ctx, oid))!;
    let roles: string[] = [];

    for (let member of members) {
        if (org.ownerId === member.uid) {
            roles.push('OWNER');
        } else if (member.role === 'admin') {
            roles.push('ADMIN');
        } else {
            roles.push('MEMBER');
        }
    }

    return roles;
}

export async function resolveOrganizationJoinedMembers(
    ctx: Context,
    args: { afterMemberId?: number | null; first?: number | null },
    orgId: number,
) {
    let afterMember: OrganizationMember | null = null;
    if (args.afterMemberId) {
        afterMember = await FDB.OrganizationMember.findById(ctx, orgId, args.afterMemberId);
    }

    let members;
    if (afterMember) {
        members = await FDB.OrganizationMember.rangeFromUniqueUserAfter(
            ctx,
            'joined',
            orgId,
            afterMember.uid,
            args.first || 10,
        );
    } else {
        if (!args.first) {
            members = await Modules.Orgs.findOrganizationMembership(ctx, orgId);
        } else {
            members = await FDB.OrganizationMember.rangeFromUniqueUser(ctx, 'joined', orgId, args.first);
        }
    }

    let roles = await resolveRoleInOrganization(ctx, orgId, members);

    let result: any[] = [];

    for (let i = 0; i < members.length; i++) {
        let member = (await FDB.User.findById(ctx, members[i].uid))!;
        result.push({
            _type: 'OrganizationJoinedMember',
            user: member,
            joinedAt: members[i].createdAt,
            email: member.email,
            showInContacts: false,
            role: roles[i],
        });
    }

    return result;
}

export async function resolveOrganizationJoinedAdminMembers(ctx: Context, args: { afterMemberId?: number | null; first?: number | null }, orgId: number) {
    let members = await resolveOrganizationJoinedMembers(ctx, args, orgId);

    return members.filter((organizationJoinedMember: any) => {
        const role = organizationJoinedMember.role;
        return role === 'OWNER' || role === 'ADMIN';
    });
}

export async function resolveOrganizationMembersWithStatus(ctx: Context, orgId: number, status: 'requested' | 'joined' | 'left') {
    let members = await Modules.Orgs.findOrganizationMembersWithStatus(ctx, orgId, status);

    let roles = await resolveRoleInOrganization(ctx, orgId, members);

    let result: any[] = [];

    for (let i = 0; i < members.length; i++) {
        let member = (await FDB.User.findById(ctx, members[i].uid))!;
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