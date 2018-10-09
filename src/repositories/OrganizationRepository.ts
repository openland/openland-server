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
        about?: string
        isCommunity?: boolean
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
                editorial: !!isEditor,
                about: Sanitizer.sanitizeString(input.about),
                isCommunity: input.isCommunity,
            }
        }, { transaction: tx });
        await Repos.Super.addToOrganization(organization.id!!, uid, tx);
        await Hooks.onOrganizstionCreated(uid, organization.id!!, tx);

        // let channel = await DB.Conversation.create({
        //     title: input.name,
        //     type: 'channel',
        //     extras: {
        //         description: '',
        //         creatorOrgId: organization.id!,
        //         isRoot: true
        //     }
        // }, { transaction: tx });
        //
        // await DB.ConversationGroupMembers.create({
        //     conversationId: channel.id,
        //     invitedById: uid,
        //     role: 'creator',
        //     status: 'member',
        //     userId: uid
        // }, { transaction: tx });
        //
        // await Repos.Chats.sendMessage(tx, channel.id, uid, { message: 'Channel created', isService: true });

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

    async notAdminOrOrgIsOpenland(member: OrganizationMember) {
        return member.orgId === 1 || !(await Repos.Permissions.superRole(member.userId));
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

    async getOrganizationJoinedMembers(orgId: number) {
        let members = await Repos.Organizations.getOrganizationMembers(orgId);

        let roles = await Repos.Permissions.resolveRoleInOrganization(members);

        let result: any[] = [];

        for (let i = 0; i < members.length; i++) {
            result.push({
                _type: 'OrganizationJoinedMember',
                user: members[i].user,
                joinedAt: (members[i] as any).createdAt,
                email: members[i].user.email,
                showInContacts: members[i].showInContacts,
                role: roles[i]
            });
        }

        return result;
    }

    async getOrganizationContacts(orgId: number): Promise<OrganizationMember[]> {
        let members = await DB.OrganizationMember.findAll({
            where: { orgId, showInContacts: true },
            order: [['createdAt', 'ASC']]
        });
        let res: OrganizationMember[] = [];
        for (let m of members) {
            if (await this.notAdminOrOrgIsOpenland(m)) {
                res.push(m);
            }
        }
        return res;
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

    async isMemberOfOrganization(orgId: number, userId: number, tx?: Transaction): Promise<boolean> {
        let isMember = await DB.OrganizationMember.findOne({
            where: {
                orgId,
                userId,
            },
            transaction: tx
        });

        return !!isMember;
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