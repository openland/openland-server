import { AllEntities, OrganizationMember } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { Sanitizer } from 'openland-utils/Sanitizer';
import { OrganizatinProfileInput } from 'openland-module-organization/OrganizationProfileInput';
import { validate, stringNotEmpty } from 'openland-utils/NewInputValidator';
import { UserError } from 'openland-errors/UserError';
import { ErrorText } from 'openland-errors/ErrorText';
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
                status: 'joined', role: 'admin'
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

    async addUserToOrganization(uid: number, oid: number) {
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
                await this.entities.OrganizationMember.create(oid, uid, { status: 'joined', role: 'member' });
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
            let isLast = (await this.entities.OrganizationMember.allFromOrganization('joined', oid)).length <= 1;
            let existing = await this.entities.OrganizationMember.findById(oid, uid);
            if (existing && existing.status === 'joined') {
                if (isLast) {
                    throw new UserError(ErrorText.unableToRemoveLastMember);
                }

                let profile = await this.entities.UserProfile.findById(uid);
                profile!.primaryOrganization = (await this.findUserOrganizations(uid))[0];
            }
            return org;
        });
    }

    //
    // Admin
    //

    async renameOrganization(id: number, title: string) {
        return await inTx(async () => {
            let org = await this.entities.Organization.findById(id);
            let profile = await this.entities.OrganizationProfile.findById(id);
            profile!.name = title;
            return org;
        });
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

    async isUserMember(uid: number, oid: number): Promise<boolean> {
        let isMember = await this.entities.OrganizationMember.findById(oid, uid);
        return !!(isMember && isMember.status === 'joined');
    }

    async isUserAdmin(uid: number, oid: number): Promise<boolean> {
        let isOwner = await this.entities.OrganizationMember.findById(oid, uid);
        return !!(isOwner && isOwner.role === 'admin');
    }

    async hasMemberWithEmail(oid: number, email: string): Promise<boolean> {
        return !!(await this.findOrganizationMembers(oid))
            .find((v) => v!.email === email);
    }
}