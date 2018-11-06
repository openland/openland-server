import { DB } from '../tables';
import { Transaction } from 'sequelize';
import { validate, stringNotEmpty } from '../modules/NewInputValidator';
import { ImageRef } from './Media';
import { Sanitizer } from '../modules/Sanitizer';
import { Repos } from '.';
import { Hooks } from './Hooks';
import { Modules } from 'openland-modules/Modules';
import { CallContext } from 'openland-server/api/utils/CallContext';
import DataLoader from 'dataloader';
import { Organization } from 'openland-server/tables/Organization';
import { FDB } from 'openland-module-db/FDB';
import { OrganizationMember } from 'openland-module-db/schema';

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

        let isEditor = (await Modules.Super.findSuperRole(uid)) === 'editor';

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
        return await FDB.OrganizationMember.findById(orgId, userId);
    }

    async notAdminOrOrgIsOpenland(member: OrganizationMember) {
        return member.oid === 1 || !(await Repos.Permissions.superRole(member.uid));
    }

    async getOrganizationMembers(orgId: number): Promise<OrganizationMember[]> {
        return await FDB.OrganizationMember.allFromOrganization('joined', orgId);
    }

    async getOrganizationJoinedMembers(orgId: number) {
        let members = await Repos.Organizations.getOrganizationMembers(orgId);

        let roles = await Repos.Permissions.resolveRoleInOrganization(members);

        let result: any[] = [];

        for (let i = 0; i < members.length; i++) {
            result.push({
                _type: 'OrganizationJoinedMember',
                user: await DB.User.findById(members[i].uid),
                joinedAt: (members[i] as any).createdAt,
                email: (await DB.User.findById(members[i].uid))!.email!,
                showInContacts: false,
                role: roles[i]
            });
        }

        return result;
    }

    async getOrganizationContacts(orgId: number): Promise<OrganizationMember[]> {
        let members = await FDB.OrganizationMember.allFromOrganization('joined', orgId);
        let res: OrganizationMember[] = [];
        for (let m of members) {
            if (await this.notAdminOrOrgIsOpenland(m)) {
                res.push(m);
            }
        }
        return res;
    }

    async isOwnerOfOrganization(orgId: number, userId: number, tx?: Transaction): Promise<boolean> {
        let isOwner = await FDB.OrganizationMember.findById(orgId, userId);

        return !!(isOwner && isOwner.role === 'admin');
    }

    async isMemberOfOrganization(orgId: number, userId: number, tx?: Transaction): Promise<boolean> {
        let isMember = await FDB.OrganizationMember.findById(orgId, userId);

        return !!isMember;
    }

    async haveMemberWithEmail(orgId: number, email: string): Promise<boolean> {
        return !!(await Promise.all(
            (await FDB.OrganizationMember.allFromOrganization('joined', orgId))
                .map((v) => DB.User.findById(v.uid))))
            .find((v) => v!.email === email);
    }

    organizationLoader(context: CallContext) {
        if (!context.cache.has('__organization_loader')) {
            context.cache.set('__organization_loader', new DataLoader<number, Organization | null>(async (ids) => {
                let foundTokens = await DB.Organization.findAll({
                    where: {
                        id: {
                            $in: ids
                        }
                    }
                });

                let res: (Organization | null)[] = [];
                for (let i of ids) {
                    let found = false;
                    for (let f of foundTokens) {
                        if (i === f.id) {
                            res.push(f);
                            found = true;
                            break;
                        }
                    }
                    if (!found) {
                        res.push(null);
                    }
                }
                return res;
            }));
        }
        let loader = context.cache.get('__organization_loader') as DataLoader<number, Organization | null>;
        return loader;
    }
}