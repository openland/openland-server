import { OrganizationMember } from '../tables/OrganizationMember';
import { DB } from '../tables';
import { Transaction } from 'sequelize';
import { validate, stringNotEmpty } from '../modules/NewInputValidator';
import { ImageRef } from './Media';
import { Sanitizer } from '../modules/Sanitizer';
import { Repos } from '.';
import { Hooks } from './Hooks';

export class OrganizationRepository {

    async createOrganization(uid: number, input: {
        name: string,
        website?: string | null
        personal: boolean
        photoRef?: ImageRef | null
    }, tx: Transaction) {
        await validate(
            stringNotEmpty('Name can\'t be empty!'),
            input.name,
            'input.name'
        );
        // Avoid multiple personal one
        if (input.personal) {
            let existing = await DB.Organization.find({
                where: {
                    userId: uid
                },
                transaction: tx,
                lock: tx.LOCK.UPDATE
            });
            if (existing) {
                return existing;
            }
        }
        let status: 'ACTIVATED' | 'PENDING' = 'PENDING';
        let user = await DB.User.find({ where: { id: uid } });
        if (user && user.status === 'ACTIVATED') {
            status = 'ACTIVATED';
        }

        let isEditor = await DB.SuperAdmin.findOne({
            where: {
                userId: uid,
                role: 'editor'
            }
        });

        let organization = await DB.Organization.create({
            name: Sanitizer.sanitizeString(input.name)!,
            website: Sanitizer.sanitizeString(input.website),
            photo: Sanitizer.sanitizeImageRef(input.photoRef),
            userId: input.personal ? uid : null,
            status: status,
            extras: {
                editorial: !!isEditor
            }
        }, { transaction: tx });
        await Repos.Super.addToOrganization(organization.id!!, uid, tx);
        await Hooks.onOrganizstionCreated(uid, organization.id!!, tx);
        return organization;
    }

    async getOrganizationMember(orgId: number, userId: number): Promise<OrganizationMember | null> {
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
                as: 'user'
            }]
        });
    }

    async getOrganizationContacts(orgId: number): Promise<OrganizationMember[]> {
        return await DB.OrganizationMember.findAll({
            where: { orgId, showInContacts: true },
            order: [['createdAt', 'ASC']],
            include: [{
                model: DB.User,
                as: 'user',
                include : [{
                    model: DB.UserProfile,
                    as: 'profile'
                }]
            }]
        });
    }

    async isOwnerOfOrganization(orgId: number, userId: number, tx?: Transaction): Promise<boolean> {
        let isOwner = await DB.OrganizationMember.findOne({
            where: {
                orgId,
                userId,
                isOwner: true
            },
            transaction: tx
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