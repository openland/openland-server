import { OrganizationMember } from '../tables/OrganizationMember';
import { DB } from '../tables';

export class OrganizationRepository {
    async getOrganizationMembers(orgId: number): Promise<OrganizationMember[]> {
        return await DB.OrganizationMember.findAll({
            where: { orgId },
            include: [{
                model: DB.User,
                as: 'user'
            }]
        });
    }

    async isOwnerOfOrganization(orgId: number, userId: number): Promise<boolean> {
        let isOwner = await DB.OrganizationMember.findOne({
            where: {
                orgId,
                userId,
                isOwner: true
            }
        });

        return !!isOwner;
    }
}