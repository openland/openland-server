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
        })).map((v) => v.user!!);
    }

    async resolvePermissions(userId: number | null | undefined) {
        await this.fetchSuperAdmins();
        let permissions: string[] = [];
        if (userId !== null && userId !== undefined) {
            permissions.push('viewer');
            if (this.isSuperAdmin(userId)) {
                permissions.push('super-admin');
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

    async isSuperAdmin(userId: number | null | undefined) {
        if (userId !== undefined && userId !== null) {
            return (await DB.SuperAdmin.find({ where: { userId: userId } })) != null;
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