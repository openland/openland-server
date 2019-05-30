import { AllEntities, OrganizationInviteLink, OrganizationPublicInviteLink } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { randomGlobalInviteKey } from 'openland-utils/random';
import { injectable, inject } from 'inversify';
import { Context } from 'openland-utils/Context';

@injectable()
export class InvitesOrganizationRepository {
    readonly entities: AllEntities;

    constructor(@inject('FDB') entities: AllEntities) {
        this.entities = entities;
    }

    async getAppInviteLinkKey(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            let existing = await this.entities.AppInviteLink.findFromUser(ctx, uid);
            if (existing) {
                return existing.id;
            }
            let res = await this.entities.AppInviteLink.create(ctx, randomGlobalInviteKey(), { uid });
            return res.id;
        });
    }

    async getAppInvteLinkData(ctx: Context, key: string) {
        return this.entities.AppInviteLink.findById(ctx, key);
    }

    public async createOrganizationInvite(
        parent: Context,
        oid: number,
        uid: number,
        firstName: string,
        lastName: string,
        email: string,
        text: string,
    ): Promise<OrganizationInviteLink> {
        return await inTx(parent, async (ctx) => {
            let existing = await this.entities.OrganizationInviteLink.findFromEmailInOrganization(ctx, email, oid);
            if (existing) {
                existing.enabled = false;
                await existing.flush(ctx);
            }
            let res = await this.entities.OrganizationInviteLink.create(ctx, randomGlobalInviteKey(), { oid, email, uid, firstName, lastName, text, enabled: true, joined: false, role: 'MEMBER', ttl: new Date().getTime() + 1000 * 60 * 60 * 24 * 7 });
            return res;
        });
    }

    public async getOrganizationInvite(ctx: Context, id: string) {
        let res = await this.entities.OrganizationInviteLink.findById(ctx, id);
        return res && (res.enabled) ? res : null;
    }

    public async getOrganizationInviteNonJoined(ctx: Context, id: string) {
        let res = await this.entities.OrganizationInviteLink.findById(ctx, id);
        return res && (res.enabled && !res.joined) ? res : null;
    }

    public async getOrganizationInvitesForOrganization(ctx: Context, orgId: number): Promise<OrganizationInviteLink[]> {
        return this.entities.OrganizationInviteLink.allFromOrganization(ctx, orgId);
    }

    public async getOrganizationInviteLink(parent: Context, oid: number, uid: number): Promise<OrganizationPublicInviteLink> {
        return await inTx(parent, async (ctx) => {
            let existing = await this.entities.OrganizationPublicInviteLink.findFromUserInOrganization(ctx, uid, oid);
            if (!existing) {
                existing = await this.entities.OrganizationPublicInviteLink.create(ctx, randomGlobalInviteKey(), { uid, oid, enabled: true });
            }
            return existing;
        });
    }

    public async getOrganizationInviteLinkByKey(ctx: Context, key: string): Promise<OrganizationPublicInviteLink | null> {
        return await this.entities.OrganizationPublicInviteLink.findById(ctx, key);
    }

    public async refreshOrganizationInviteLink(parent: Context, oid: number, uid: number): Promise<OrganizationPublicInviteLink> {
        return await inTx(parent, async (ctx) => {
            let existing = await this.entities.OrganizationPublicInviteLink.findFromUserInOrganization(ctx, uid, oid);
            if (existing) {
                existing.enabled = false;
                await existing.flush(ctx);
            }
            let res = await this.entities.OrganizationPublicInviteLink.create(ctx, randomGlobalInviteKey(), { uid, oid, enabled: true });
            return res;
        });
    }
}