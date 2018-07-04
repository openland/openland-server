import { OrganizationMember } from '../tables/OrganizationMember';
import { DB } from '../tables';

export class OrganizationRepository {
    async getOrganizationMember(orgId: number, userId: number): Promise<OrganizationMember|null> {
        return await DB.OrganizationMember.findOne({
            where: {
                orgId,
                userId
            },
            include: [{
                model: DB.User,
                as: 'user',
            }]
        });
    }

    async getOrganizationMembers(orgId: number): Promise<OrganizationMember[]> {
        return await DB.OrganizationMember.findAll({
            where: { orgId },
            order: [['createdAt', 'DESC']],
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

    async haveMemberWithEmail(orgId: number, email: string): Promise<boolean> {
        let member = await DB.OrganizationMember.findOne({
            where: {
                orgId,
            },
            include: [{
                model: DB.User,
                as: 'user',
                where: {
                    email
                }
            }]
        });

        return !!member;
    }
}