import { DB } from '../tables/index';

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

    async resolvePermissions(userId: number | null | undefined) {
        let permissions: string[] = [];
        if (userId !== null && userId !== undefined) {
            permissions.push('viewer');
            let superRole = await this.superRole(userId);
            if (superRole !== false) {
                permissions.push(superRole);
            }
            let members = await DB.AccountMember.findAll({
                where: {
                    userId: userId
                }
            });
            for (let m of members) {
                let slug = (await DB.Account.findById(m.accountId))!!.slug;
                permissions.push('account-' + slug + '-veiewer');
                if (m.owner === true) {
                    permissions.push('account-' + slug + '-admin');
                }
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
}