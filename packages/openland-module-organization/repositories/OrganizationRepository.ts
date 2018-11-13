import { AllEntities, OrganizationMember } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { Sanitizer } from 'openland-utils/Sanitizer';
import { OrganizatinProfileInput } from 'openland-module-organization/OrganizationProfileInput';
import { validate, stringNotEmpty } from 'openland-utils/NewInputValidator';
import { injectable } from 'inversify';

@injectable()
export class OrganizationRepository {
    readonly entities: AllEntities;

    constructor(entities: AllEntities) {
        this.entities = entities;
    }

    async createOrganization(uid: number, input: OrganizatinProfileInput, opts: { editorial: boolean, status: 'activated' | 'pending' | 'suspended' }) {
        await validate(
            stringNotEmpty('Name can\'t be empty!'),
            input.name,
            'input.name'
        );

        return await inTx(async () => {

            // Fetch Organization Number
            let seq = (await this.entities.Sequence.findById('org-id'));
            if (!seq) {
                seq = await this.entities.Sequence.create('org-id', { value: 0 });
            }
            let orgId = ++seq.value;
            await seq.flush();

            // Create organization
            let organization = await this.entities.Organization.create(orgId, {
                kind: input.isCommunity ? 'community' : 'organization',
                ownerId: uid,
                status: opts.status,
                editorial: opts.editorial,
            });

            // Create organization profile
            await this.entities.OrganizationProfile.create(orgId, {
                name: Sanitizer.sanitizeString(input.name)!,
                website: Sanitizer.sanitizeString(input.website),
                photo: Sanitizer.sanitizeImageRef(input.photoRef),
                about: Sanitizer.sanitizeString(input.about)
            });

            // Create editorial data
            await this.entities.OrganizationEditorial.create(orgId, {
                listed: true,
                featured: false
            });

            // Add owner to organization
            await this.entities.OrganizationMember.create(organization.id, uid, {
                status: 'joined', role: 'admin', invitedBy: uid
            });

            return organization;
        });
    }

    async activateOrganization(id: number) {
        return await inTx(async () => {
            let org = (await this.entities.Organization.findById(id))!;
            if (org.status !== 'activated') {
                org.status = 'activated';
                await org.flush();
                return true;
            }
            return false;
        });
    }

    async suspendOrganization(id: number) {
        return await inTx(async () => {
            let org = (await this.entities.Organization.findById(id))!;
            if (org.status !== 'suspended') {
                org.status = 'suspended';
                await org.flush();
                return true;
            } else {
                return false;
            }
        });
    }

    async addUserToOrganization(uid: number, oid: number, by: number) {
        return await inTx(async () => {
            let org = await this.entities.Organization.findById(oid);
            if (!org) {
                throw Error('Unable to find organization');
            }
            let ex = await this.entities.OrganizationMember.findById(oid, uid);
            if (ex && ex.status === 'joined') {
                return false;
            } else if (ex) {
                ex.status = 'joined';
                return true;
            } else {
                await this.entities.OrganizationMember.create(oid, uid, { status: 'joined', role: 'member', invitedBy: by });
                return true;
            }
        });
    }

    async removeUserFromOrganization(uid: number, oid: number) {
        return await inTx(async () => {
            let org = await this.entities.Organization.findById(oid);
            if (!org) {
                throw Error('Unable to find organization');
            }
            if (await this.isUserOwner(uid, oid)) {
                throw Error('Unable to remove owner');
            }

            let existing = await this.entities.OrganizationMember.findById(oid, uid);
            if (!existing || existing.status !== 'joined') {
                return false;
            }
            existing.status = 'left';
            existing.role = 'member'; // Downgrade membership
            await existing.flush();
            return true;
        });
    }

    async updateMembershipRole(uid: number, oid: number, role: 'admin' | 'member') {
        return await inTx(async () => {
            let member = await this.entities.OrganizationMember.findById(oid, uid);
            if (!member || member.status !== 'joined') {
                throw Error('User is not a member of organization');
            }
            if (member.role === role) {
                return false;
            }
            member.role = role;
            await member.flush();
            return true;
        });
    }

    //
    // Permissions
    //

    async isUserMember(uid: number, oid: number): Promise<boolean> {
        let isMember = await this.entities.OrganizationMember.findById(oid, uid);
        return !!(isMember && isMember.status === 'joined');
    }

    async isUserAdmin(uid: number, oid: number): Promise<boolean> {
        let isOwner = await this.entities.OrganizationMember.findById(oid, uid);
        return !!(isOwner && isOwner.status === 'joined' && isOwner.role === 'admin');
    }

    async isUserOwner(uid: number, oid: number): Promise<boolean> {
        let org = await this.entities.Organization.findById(oid);
        return !!(org && org.ownerId === uid);
    }

    //
    // Queries
    //

    async findOrganizationMembership(oid: number) {
        return await this.entities.OrganizationMember.allFromOrganization('joined', oid);
    }

    async findOrganizationMembers(oid: number) {
        return (await Promise.all((await this.findOrganizationMembership(oid))
            .map((v) => this.entities.User.findById(v.uid))))
            .map((v) => v!);
    }

    async findUserOrganizations(uid: number): Promise<number[]> {
        return (await this.entities.OrganizationMember.allFromUser('joined', uid)).map((v) => v.oid);
    }

    async findUserMembership(uid: number, oid: number): Promise<OrganizationMember | null> {
        return await this.entities.OrganizationMember.findById(oid, uid);
    }

    async hasMemberWithEmail(oid: number, email: string): Promise<boolean> {
        return !!(await this.findOrganizationMembers(oid))
            .find((v) => v!.email === email);
    }

    //
    // Tools
    //
    async markForUndexing(oid: number) {
        await inTx(async () => {
            let existing = await this.entities.OrganizationIndexingQueue.findById(oid);
            if (existing) {
                existing.markDirty();
            } else {
                await this.entities.OrganizationIndexingQueue.create(oid, {});
            }
        });

    }

    //
    // Deprecated
    //

    async renameOrganization(id: number, title: string) {
        return await inTx(async () => {
            let org = await this.entities.Organization.findById(id);
            let profile = await this.entities.OrganizationProfile.findById(id);
            profile!.name = title;
            return org;
        });
    }
}