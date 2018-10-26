import { DB } from '../tables';
import { NotFoundError } from '../errors/NotFoundError';
import { ErrorText } from '../errors/ErrorText';
import { IDs } from '../api/utils/IDs';
import { OrganizationMember } from '../tables/OrganizationMember';
import { Modules } from 'openland-modules/Modules';

export class PermissionRepository {

    async resolvePermissions(args: { uid: number | null | undefined, oid: number | null | undefined }) {
        let permissions = new Set<string>();

        console.log(args);
        //
        // User Based Permissions
        //
        if (args.uid) {
            let user = await DB.User.find({ where: { id: args.uid } });
            if (user == null) {
                throw new NotFoundError(ErrorText.unableToFindUser);
            }
            permissions.add('viewer');

            console.log(1111, args.uid);
            // Super Role
            let superRole = await this.superRole(args.uid);
            console.log(superRole);
            if (superRole !== false) {
                permissions.add(superRole);
                if (superRole === 'super-admin') {
                    permissions.add('software-developer');
                }
            }
        }

        //
        // Organization Based Permissions
        //
        if (args.uid && args.oid) {

            //
            // Membership
            //

            let members = await DB.OrganizationMember.findAll(({
                where: {
                    userId: args.uid,
                }
            }));
            for (let member of members) {
                permissions.add('org-' + IDs.Organization.serialize(member.orgId) + '-member');
                if (member.isOwner) {
                    permissions.add('org-' + IDs.Organization.serialize(member.orgId) + '-admin');
                }
            }

            //
            // Organization features
            //
            let org = await DB.Organization.findById(args.oid);
            if (org) {
                let features = await Modules.Features.repo.findOrganizationFeatures(org.id!);
                for (let f of features) {
                    permissions.add('feature-' + f.featureKey);
                }
            }
        }

        return permissions;
    }

    async resolveRoleInOrganization(members: OrganizationMember[]): Promise<string[]> {
        let roles: string[] = [];

        for (let member of members) {
            if (member.user) {
                if (member.isOwner) {
                    roles.push(`OWNER`);
                } else {
                    roles.push(`MEMBER`);
                }
            }
        }

        return roles;
    }

    async superRole(userId: number | null | undefined): Promise<string | false> {
        if (userId !== undefined && userId !== null) {
            let role = await Modules.Super.findSuperRole(userId);
            if (role !== null) {
                return role;
            }
            return false;
        } else {
            return false;
        }
    }
}