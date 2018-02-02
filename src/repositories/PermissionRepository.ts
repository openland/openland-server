import { DB } from '../tables/index';

export interface AreaPermissions {
    isOwner: boolean;
}

export class PermissionRepository {

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