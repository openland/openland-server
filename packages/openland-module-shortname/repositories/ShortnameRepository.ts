import { AllEntities, ShortnameReservation } from 'openland-module-db/schema';
import { inTx } from 'foundation-orm/inTx';
import { UserError } from 'openland-errors/UserError';
import { Context } from 'openland-utils/Context';
import { Modules } from '../../openland-modules/Modules';
import { lazyInject } from '../../openland-modules/Modules.container';
import { injectable } from 'inversify';

@injectable()
export class ShortnameRepository {
    @lazyInject('FDB')
    private readonly entities!: AllEntities;

    private reservedNames = new Set([
        'signup',
        'root',
        'init',
        'invite',
        'channel',
        'joinChannel',
        'need_info',
        'activation',
        'waitlist',
        'suspended',
        'createProfile',
        'createOrganization',
        'join',
        '404',
        'acceptChannelInvite',
        'map',
        'settings',
        'profile',
        'notifications',
        'invites',
        'dev',
        'organization',
        'new',
        'feed',
        'directory',
        'main',
        'people',
        'organizations',
        'communities',
        'marketplace',
        'mail',
        // 'support',
        'super',
        'compatibility',
        'performance',
        'landing',
        'auth',
        'login',
        'logout',
        'complete',
        'privacy',
        'terms',
        'about',
        'users'
    ]);

    async findShortname(ctx: Context, shortname: string) {
        let record =  await this.entities.ShortnameReservation.findById(ctx, shortname);
        if (record && record.enabled) {
            return record;
        } else {
            return null;
        }
     }

    async findUserShortname(ctx: Context, uid: number) {
        let existing = await this.entities.ShortnameReservation.findFromUser(ctx, uid);
        if (existing && existing.enabled) {
            return existing;
        } else {
            return null;
        }
    }

    async findOrganizationShortname(ctx: Context, uid: number) {
        let existing = await this.entities.ShortnameReservation.findFromOrg(ctx, uid);
        if (existing && existing.enabled) {
            return existing;
        } else {
            return null;
        }
    }

    async setShortnameToUser(parent: Context, shortname: string, uid: number) {
        return await inTx(parent, async ctx => {
            let res = await this.setShortName(parent, shortname, uid, 'user', uid);
            await Modules.Users.markForUndexing(ctx, uid);
            return res;
        });
    }

    async setShortnameToOrganization(parent: Context, shortname: string, oid: number, uid: number) {
        return await inTx(parent, async ctx => {
            let res = await this.setShortName(ctx, shortname, oid, 'org', uid);
            await Modules.Orgs.markForUndexing(ctx, oid);
            return res;
        });
    }

    private async setShortName(parent: Context, shortname: string, ownerId: number, ownerType: 'user' | 'org', uid: number) {
        return await inTx(parent, async ctx => {
            let normalized = await this.normalizeShortname(ctx, shortname, uid);

            let oldShortname: ShortnameReservation|null;

            if (ownerType === 'user') {
                oldShortname = await this.entities.ShortnameReservation.findFromUser(ctx, ownerId);
            } else if (ownerType === 'org') {
                oldShortname = await this.entities.ShortnameReservation.findFromOrg(ctx, ownerId);
            } else {
                throw new Error('Unknown shortname owner type');
            }

            if (oldShortname && oldShortname.shortname === normalized) {
                return true;
            } else if (oldShortname) {
                // release previous reservation
                oldShortname.enabled = false;
                await oldShortname.flush();
            }

            let existing = await this.entities.ShortnameReservation.findById(ctx, normalized);

            if ((existing && existing.enabled) || this.reservedNames.has(normalized)) {
                throw new UserError('Sorry, this shortname is already taken!');
            } else if (existing) {
                existing.ownerId = ownerId;
                existing.ownerType = ownerType;
                existing.enabled = true;
                await existing.flush();
                return true;
            } else {
                await this.entities.ShortnameReservation.create(ctx, normalized, { ownerId, ownerType, enabled: true });
                return true;
            }
        });
    }

    private async normalizeShortname(parent: Context, shortname: string, uid: number) {
        return await inTx(parent, async (ctx) => {
            let role = await Modules.Super.superRole(ctx, uid);
            let isAdmin = role === 'super-admin';

            // TODO: Implement correct shortname validation here
            let normalized = shortname.toLowerCase();
            if (normalized.length > 16) {
                throw new UserError('Shortname is too long');
            }
            if (normalized.length < (isAdmin ? 3 : 5)) {
                throw new UserError('Shortname is too short');
            }
            if (!/^\w*$/.test(shortname)) {
                throw new UserError('Invalid shortname');
            }
            return normalized;
        });
    }
}