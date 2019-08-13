import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { OrganizationMember } from 'openland-module-db/store';
import { Context } from '@openland/context';

export async function resolveRoleInOrganization(ctx: Context, oid: number, member: OrganizationMember): Promise<string> {
    let org = (await Store.Organization.findById(ctx, oid))!;

    if (org.ownerId === member.uid) {
        return 'OWNER';
    } else if (member.role === 'admin') {
        return 'ADMIN';
    } else {
        return 'MEMBER';
    }
}

async function resolveRolesInOrganization(ctx: Context, oid: number, members: OrganizationMember[]): Promise<string[]> {
    let org = (await Store.Organization.findById(ctx, oid))!;
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
        afterMember = await Store.OrganizationMember.findById(ctx, orgId, args.afterMemberId);
    }

    let members;
    if (afterMember) {
        members = (await Store.OrganizationMember.organization.query(
            ctx,
            'joined',
            orgId,
            { limit: args.first || 10, after: afterMember.uid }
        )).items;
    } else {
        if (!args.first) {
            members = await Modules.Orgs.findOrganizationMembership(ctx, orgId);
        } else {
            members = (await Store.OrganizationMember.organization.query(ctx, 'joined', orgId, { limit: args.first })).items;
        }
    }

    let roles = await resolveRolesInOrganization(ctx, orgId, members);

    let result: any[] = [];

    for (let i = 0; i < members.length; i++) {
        let member = (await Store.User.findById(ctx, members[i].uid))!;
        result.push({
            _type: 'OrganizationJoinedMember',
            user: member,
            joinedAt: members[i].metadata.createdAt,
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

    return [];
}

export async function resolveOrganizationMembersWithStatus(ctx: Context, orgId: number, status: 'requested' | 'joined' | 'left') {
    let members = await Modules.Orgs.findOrganizationMembersWithStatus(ctx, orgId, status);

    let roles = await resolveRolesInOrganization(ctx, orgId, members);

    let result: any[] = [];

    for (let i = 0; i < members.length; i++) {
        let member = (await Store.User.findById(ctx, members[i].uid))!;
        result.push({
            _type: 'OrganizationJoinedMember',
            user: member,
            joinedAt: members[i].metadata.createdAt,
            email: member.email,
            showInContacts: false,
            role: roles[i]
        });
    }

    return result;
}