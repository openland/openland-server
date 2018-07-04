import { OrganizationMember } from '../tables/OrganizationMember';
import { DB } from '../tables';
import sequelize from 'sequelize';

export class OrganizationRepository {
    async getOrganizationMembers(orgId: number): Promise<OrganizationMember[]> {
        return await DB.OrganizationMember.findAll({
            where: { orgId },
            order: [sequelize.literal('user.userProfile.name')],
            include: [{
                model: DB.User,
                as: 'user',
                include: [{
                    model: DB.UserProfile,
                    as: 'userProfile'
                }]
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