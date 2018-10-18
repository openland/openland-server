import { DB } from '../tables';
import { FeatureFlag } from '../tables/FeatureFlag';
import { NotFoundError } from '../errors/NotFoundError';
import { ErrorText } from '../errors/ErrorText';
import { IDs } from '../api/utils/IDs';
import { OrganizationMember } from '../tables/OrganizationMember';

export interface AreaPermissions {
    isOwner: boolean;
}

export class PermissionRepository {

    async fetchSuperAdmins() {
        return (await DB.SuperAdmin.findAll({
            include: [
                { model: DB.User }
            ]
        }));
    }

    async resolveFeatureFlags() {
        return DB.FeatureFlag.findAll();
    }

    async createFeatureFlag(key: string, title: string) {
        return DB.FeatureFlag.create({ key: key, title: title });
    }

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
                let features = ((await (org as any).getFeatureFlags()) as [FeatureFlag]);
                for (let f of features) {
                    permissions.add('feature-' + f.key);
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
            let roles = await DB.SuperAdmin.findOne({ where: { userId: userId } });
            if (roles !== null) {
                if (roles.role === null) {
                    return 'super-admin';
                } else {
                    return roles.role!!;
                }
            }
            return false;
        } else {
            return false;
        }
    }

    async resolveAreaPermissions(areaId: number, userId: number | null | undefined): Promise<AreaPermissions> {
        if (userId !== undefined && userId !== null) {
            let member = await DB.AccountMember.findOne({
                where: {
                    accountId: areaId,
                    userId: userId
                }
            });

            if (member) {
                return {
                    isOwner: member.owner!!
                };
            }
        }

        return {
            isOwner: false
        };
    }
}