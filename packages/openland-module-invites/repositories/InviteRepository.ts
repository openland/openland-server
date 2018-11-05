import { AllEntities, OrganizationInviteLink, OrganizationPublicInviteLink } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { randomGlobalInviteKey } from 'openland-server/utils/random';

export class InviteRepository {
    private readonly entities: AllEntities;

    constructor(entities: AllEntities) {
        this.entities = entities;
    }

    async getInviteLinkKey(uid: number) {
        return await inTx(async () => {
            let existing = await this.entities.AppInviteLink.findFromUser(uid);
            if (existing) {
                return existing.id;
            }
            let res = await this.entities.AppInviteLink.create(randomGlobalInviteKey(), { uid });
            return res.id;
        });
    }

    async getInvteLinkData(key: string) {
        return this.entities.AppInviteLink.findById(key);
    }

    public async createOrganizationInvite(
        oid: number,
        uid: number,
        firstName: string,
        lastName: string,
        email: string,
        text: string,
        role: 'MEMBER' | 'OWNER',
    ): Promise<OrganizationInviteLink> {
        return await inTx(async () => {
            let existing = await this.entities.OrganizationInviteLink.findFromEmailInOrganization(email, oid);
            if (existing) {
                existing.enabled = false;
            }
            let res = await this.entities.OrganizationInviteLink.create(randomGlobalInviteKey(), { oid, email, uid, firstName, lastName, text, enabled: true, joined: false, role, ttl: 1000 * 60 * 60 * 24 * 7 });
            return res;
        });
    }

    public async getOrganizationInvite(id: string) {
        let res = await this.entities.OrganizationInviteLink.findById(id);
        return res && (res.enabled) ? res : null;
    }

    public async getOrganizationInviteNonJoined(id: string) {
        let res = await this.entities.OrganizationInviteLink.findById(id);
        return res && (res.enabled && !res.joined) ? res : null;
    }

    public async getOrganizationInvitesForOrganization(orgId: number): Promise<OrganizationInviteLink[]> {
        return this.entities.OrganizationInviteLink.allFromOrganization(orgId);
    }

    public async getOrganizationInvitesForUser(orgId: number): Promise<OrganizationInviteLink[]> {
        return this.entities.OrganizationInviteLink.allFromOrganization(orgId);
    }

    public async getPublicOrganizationInvite(oid: number, uid: number): Promise<OrganizationPublicInviteLink> {
        return await inTx(async () => {
            let existing = await this.entities.OrganizationPublicInviteLink.findFromUserInOrganization(uid, oid);
            if (!existing) {
                existing = await this.entities.OrganizationPublicInviteLink.create(randomGlobalInviteKey(), { uid, oid, enabled: true });
            }
            return existing;
        });
    }

    public async getPublicOrganizationInviteByKey(key: string): Promise<OrganizationPublicInviteLink | null> {
        return await this.entities.OrganizationPublicInviteLink.findById(key);
    }

    public async deletePublicOrganizationInvite(oid: number, uid: number): Promise<void> {
        return await inTx(async () => {
            let existing = await this.entities.OrganizationPublicInviteLink.findFromUserInOrganization(uid, oid);
            if (existing) {
                existing.enabled = false;
            }
        });
    }

    public async createPublicOrganizationInvite(oid: number, uid: number): Promise<OrganizationPublicInviteLink> {
        return await inTx(async () => {
            let existing = await this.entities.OrganizationPublicInviteLink.findFromUserInOrganization(uid, oid);
            if (existing) {
                existing.enabled = false;
            }
            let res = await this.entities.OrganizationPublicInviteLink.create(randomGlobalInviteKey(), { uid, oid, enabled: true });
            return res;
        });
    }
}