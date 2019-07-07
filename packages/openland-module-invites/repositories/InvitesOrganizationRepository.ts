import { OrganizationPublicInviteLink } from './../../openland-module-db/store';
import { inTx } from '@openland/foundationdb';
import { randomGlobalInviteKey } from 'openland-utils/random';
import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { Store } from 'openland-module-db/FDB';
import { OrganizationInviteLink } from 'openland-module-db/store';

@injectable()
export class InvitesOrganizationRepository {

    async getAppInviteLinkKey(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            let existing = await Store.AppInviteLink.user.find(ctx, uid);
            if (existing) {
                return existing.id;
            }
            let res = await Store.AppInviteLink.create(ctx, randomGlobalInviteKey(), { uid });
            return res.id;
        });
    }

    async getAppInvteLinkData(ctx: Context, key: string) {
        return Store.AppInviteLink.findById(ctx, key);
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
            let existing = await Store.OrganizationInviteLink.emailInOrganization.find(ctx, email, oid);
            if (existing) {
                existing.enabled = false;
                await existing.flush(ctx);
            }
            let res = await Store.OrganizationInviteLink.create(ctx, randomGlobalInviteKey(), { oid, email, uid, firstName, lastName, text, enabled: true, joined: false, role: 'MEMBER', ttl: new Date().getTime() + 1000 * 60 * 60 * 24 * 7 });
            return res;
        });
    }

    public async getOrganizationInvite(ctx: Context, id: string) {
        let res = await Store.OrganizationInviteLink.findById(ctx, id);
        return res && (res.enabled) ? res : null;
    }

    public async getOrganizationInviteNonJoined(ctx: Context, id: string) {
        let res = await Store.OrganizationInviteLink.findById(ctx, id);
        return res && (res.enabled && !res.joined) ? res : null;
    }

    public async getOrganizationInvitesForOrganization(ctx: Context, orgId: number): Promise<OrganizationInviteLink[]> {
        return Store.OrganizationInviteLink.organization.findAll(ctx, orgId);
    }

    public async getOrganizationInviteLink(parent: Context, oid: number, uid: number): Promise<OrganizationPublicInviteLink> {
        return await inTx(parent, async (ctx) => {
            let existing = await Store.OrganizationPublicInviteLink.userInOrganization.find(ctx, uid, oid);
            if (!existing) {
                existing = await Store.OrganizationPublicInviteLink.create(ctx, randomGlobalInviteKey(), { uid, oid, enabled: true });
            }
            return existing;
        });
    }

    public async getOrganizationInviteLinkByKey(ctx: Context, key: string): Promise<OrganizationPublicInviteLink | null> {
        return await Store.OrganizationPublicInviteLink.findById(ctx, key);
    }

    public async refreshOrganizationInviteLink(parent: Context, oid: number, uid: number): Promise<OrganizationPublicInviteLink> {
        return await inTx(parent, async (ctx) => {
            let existing = await Store.OrganizationPublicInviteLink.userInOrganization.find(ctx, uid, oid);
            if (existing) {
                existing.enabled = false;
                await existing.flush(ctx);
            }
            let res = await Store.OrganizationPublicInviteLink.create(ctx, randomGlobalInviteKey(), { uid, oid, enabled: true });
            return res;
        });
    }
}