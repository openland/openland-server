import { validate, stringNotEmpty } from '../modules/NewInputValidator';
import { Sanitizer } from '../modules/Sanitizer';
import { Repos } from '.';
import { Hooks } from './Hooks';
import { Modules } from 'openland-modules/Modules';
import { FDB } from 'openland-module-db/FDB';
import { OrganizationMember } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { ImageRef } from 'openland-module-media/ImageRef';

export class OrganizationRepository {

    async createOrganization(uid: number, input: {
        name: string,
        website?: string | null
        personal: boolean
        photoRef?: ImageRef | null
        about?: string
        isCommunity?: boolean
    }) {
        await validate(
            stringNotEmpty('Name can\'t be empty!'),
            input.name,
            'input.name'
        );

        return await inTx(async () => {
            let status: 'activated' | 'pending' = 'pending';
            let user = await FDB.User.findById(uid);
            if (user && user.status === 'activated') {
                status = 'activated';
            }

            let isEditor = (await Modules.Super.findSuperRole(uid)) === 'editor';

            let orgId = ++(await FDB.Sequence.findById('org-id'))!.value;
            let organization = await FDB.Organization.create(orgId, {
                kind: input.isCommunity ? 'community' : 'organization',
                ownerId: uid,
                status: status,
                editorial: !!isEditor,
            });
            await FDB.OrganizationProfile.create(orgId, {
                name: Sanitizer.sanitizeString(input.name)!,
                website: Sanitizer.sanitizeString(input.website),
                photo: Sanitizer.sanitizeImageRef(input.photoRef),
                about: Sanitizer.sanitizeString(input.about)
            });

            await FDB.OrganizationEditorial.create(orgId, {
                listed: true,
                featured: false
            });

            await Repos.Super.addToOrganization(organization.id!!, uid);
            await Hooks.onOrganizstionCreated(uid, organization.id!!);

            return organization;
        });
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
                user: await FDB.User.findById(members[i].uid),
                joinedAt: (members[i] as any).createdAt,
                email: (await FDB.User.findById(members[i].uid))!.email,
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

    async isOwnerOfOrganization(orgId: number, userId: number): Promise<boolean> {
        let isOwner = await FDB.OrganizationMember.findById(orgId, userId);

        return !!(isOwner && isOwner.role === 'admin');
    }

    async isMemberOfOrganization(orgId: number, userId: number): Promise<boolean> {
        let isMember = await FDB.OrganizationMember.findById(orgId, userId);

        return !!isMember;
    }

    async haveMemberWithEmail(orgId: number, email: string): Promise<boolean> {
        return !!(await Promise.all(
            (await FDB.OrganizationMember.allFromOrganization('joined', orgId))
                .map((v) => FDB.User.findById(v.uid))))
            .find((v) => v!.email === email);
    }
}