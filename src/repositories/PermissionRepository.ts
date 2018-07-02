import { DB } from '../tables/index';
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

        //
        // User Based Permissions
        //
        if (args.uid) {
            let user = await DB.User.find({ where: { id: args.uid } });
            if (user == null) {
                throw new NotFoundError(ErrorText.unableToFindUser);
            }
            permissions.add('viewer');

            // Super Role
            let superRole = await this.superRole(args.uid);
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

            let member = await DB.OrganizationMember.find(({
                where: {
                    userId: args.uid,
                    orgId: args.oid
                }
            }));
            if (member) {
                permissions.add('org-' + IDs.Organization.serialize(args.oid) + '-member');
                if (member.isOwner) {
                    permissions.add('org-' + IDs.Organization.serialize(args.oid) + '-admin');
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

    async resolvePermissionsInOrganization(members: OrganizationMember[]): Promise<string[][]> {
        let permissions: string[][] = [];

        for (let member of members) {
            if (member.user) {
                let orgId = IDs.Organization.serialize(member.orgId);

                let memberPermissions = [`org-${orgId}-member`];

                if (member.isOwner) {
                    memberPermissions.push(`org-${orgId}-admin`);
                }

                permissions.push(memberPermissions);
            }
        }

        return permissions;
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

    async resolveCiites() {
        return await DB.SuperCity.findAll();
    }
}