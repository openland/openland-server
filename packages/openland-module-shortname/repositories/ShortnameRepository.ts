import { Store } from './../../openland-module-db/FDB';
import { transactional } from '@openland/foundationdb';
import { UserError } from 'openland-errors/UserError';
import { Context } from '@openland/context';
import { Modules } from '../../openland-modules/Modules';
import { injectable } from 'inversify';

export type OwnerType = 'user' | 'org' | 'feed_channel' | 'room' | 'collection' | 'hub';

@injectable()
export class ShortnameRepository {

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

    @transactional
    async findShortname(ctx: Context, shortname: string) {
        let record = await Store.ShortnameReservation.findById(ctx, shortname);
        if (record && record.enabled) {
            return record;
        }
        return null;
    }

    @transactional
    async findShortnameByOwner(parent: Context, ownerType: OwnerType, ownerId: number) {
        let record = await Store.ShortnameReservation.fromOwner.find(parent, ownerType, ownerId);
        if (record && record.enabled) {
            return record;
        }
        return null;
    }

    @transactional
    async setShortName(ctx: Context, shortname: string, ownerType: OwnerType, ownerId: number, uid: number) {
        let normalized = await this.normalizeShortname(ctx, shortname, ownerType, uid);

        let oldShortname = await Store.ShortnameReservation.fromOwner.find(ctx, ownerType, ownerId);

        if (oldShortname && oldShortname.shortname === normalized) {
            return true;
        } else if (oldShortname) {
            // release previous reservation
            oldShortname.enabled = false;
            await oldShortname.flush(ctx);
        }
        if (normalized === '') {
            return true;
        }

        let existing = await Store.ShortnameReservation.findById(ctx, normalized);

        if ((existing && existing.enabled) || this.reservedNames.has(normalized)) {
            throw new UserError(`Sorry, this ${ownerType === 'user' ? 'username' : 'shortname'} is already taken!`);
        } else if (existing) {
            existing.ownerId = ownerId;
            existing.ownerType = ownerType;
            existing.enabled = true;
            await existing.flush(ctx);
            return true;
        } else {
            await Store.ShortnameReservation.create(ctx, normalized, { ownerId, ownerType, enabled: true });
            return true;
        }
    }

    @transactional
    async freeShortName(ctx: Context, ownerType: OwnerType, ownerId: number) {
        let existing = await Store.ShortnameReservation.fromOwner.find(ctx, ownerType, ownerId);
        if (!existing || !existing.enabled) {
            return true;
        }
        existing.enabled = false;
        await existing.flush(ctx);
        return true;
    }

    private async normalizeShortname(ctx: Context, shortname: string, ownerType: OwnerType, uid: number) {
        let role = await Modules.Super.superRole(ctx, uid);
        let isAdmin = role === 'super-admin';

        let ownerName = ownerType === 'user' ? 'Username' : 'Shortname';

        // TODO: Implement correct shortname validation here
        let normalized = shortname.trim().toLowerCase();
        if (normalized.length > 16) {
            throw new UserError(`${ownerName} cannot be longer than 16 characters.`);
        }
        if (shortname.length !== 0 && normalized.length < (isAdmin ? 3 : 5)) {
            throw new UserError(`${ownerName} must have at least 5 characters.`);
        }
        if (!/^\w*$/.test(shortname)) {
            throw new UserError(`${ownerName} can only contain a-z, 0-9, and underscores.`);
        }
        return normalized;
    }
}