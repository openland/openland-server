import { AllEntities, OrganizationMember } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { Modules } from 'openland-modules/Modules';
import { Sanitizer } from 'openland-utils/Sanitizer';
import { OrganizatinProfileInput } from 'openland-module-orgs/OrganizationProfileInput';
import { validate, stringNotEmpty } from 'openland-utils/NewInputValidator';
import { Repos } from 'openland-server/repositories';
import { Hooks } from 'openland-server/repositories/Hooks';

export class OrganizationRepository {
    readonly entities: AllEntities;
    
    constructor(entities: AllEntities) {
        this.entities = entities;
    }

    async createOrganization(uid: number, input: OrganizatinProfileInput) {
        await validate(
            stringNotEmpty('Name can\'t be empty!'),
            input.name,
            'input.name'
        );

        return await inTx(async () => {
            let status: 'activated' | 'pending' = 'pending';
            let user = await this.entities.User.findById(uid);
            if (user && user.status === 'activated') {
                status = 'activated';
            }

            let isEditor = (await Modules.Super.findSuperRole(uid)) === 'editor';
            let seq = (await this.entities.Sequence.findById('org-id'))!;
            let orgId = ++seq.value;
            await seq.flush();

            let organization = await this.entities.Organization.create(orgId, {
                kind: input.isCommunity ? 'community' : 'organization',
                ownerId: uid,
                status: status,
                editorial: !!isEditor,
            });
            await this.entities.OrganizationProfile.create(orgId, {
                name: Sanitizer.sanitizeString(input.name)!,
                website: Sanitizer.sanitizeString(input.website),
                photo: Sanitizer.sanitizeImageRef(input.photoRef),
                about: Sanitizer.sanitizeString(input.about)
            });

            await this.entities.OrganizationEditorial.create(orgId, {
                listed: true,
                featured: false
            });

            await Repos.Super.addToOrganization(organization.id, uid);
            await Hooks.onOrganizstionCreated(uid, organization.id);

            return organization;
        });
    }

    async findOrganizationMembers(organizationId: number) {
        return (await Promise.all((await this.entities.OrganizationMember.allFromOrganization('joined', organizationId))
            .map((v) => this.entities.User.findById(v.uid))))
            .map((v) => v!);
    }

    async findOrganizationMembership(organizationId: number) {
        return await this.entities.OrganizationMember.allFromOrganization('joined', organizationId);
    }

    async findUserOrganizations(uid: number): Promise<number[]> {
        return (await this.entities.OrganizationMember.allFromUser('joined', uid)).map((v) => v.oid);
    }

    async fundUserMembership(uid: number, oid: number): Promise<OrganizationMember | null> {
        return await this.entities.OrganizationMember.findById(oid, uid);
    }

    async isUserMember(uid: number, orgId: number): Promise<boolean> {
        let isMember = await this.entities.OrganizationMember.findById(orgId, uid);
        return !!(isMember && isMember.status === 'joined');
    }

    async isUserAdmin(uid: number, oid: number): Promise<boolean> {
        let isOwner = await this.entities.OrganizationMember.findById(oid, uid);
        return !!(isOwner && isOwner.role === 'admin');
    }

    async hasMemberWithEmail(oid: number, email: string): Promise<boolean> {
        return !!(await Promise.all(
            (await this.entities.OrganizationMember.allFromOrganization('joined', oid))
                .map((v) => this.entities.User.findById(v.uid))))
            .find((v) => v!.email === email);
    }
}