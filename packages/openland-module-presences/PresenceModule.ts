import { UserPresenceMediator } from './mediator/UserPresenceMediator';
import { GroupPresenceMediator } from './mediator/GroupPresenceMediator';
import { Store } from './../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { injectable } from 'inversify';
import { Modules } from '../openland-modules/Modules';
import { Context } from '@openland/context';
import { PresenceLogRepository } from './repo/PresenceLogRepository';
import { lazyInject } from 'openland-modules/Modules.container';

function detectPlatform(platform: string): 'undefined' | 'web' | 'android' | 'ios' | 'desktop' {
    if (!platform) {
        return 'undefined';
    }

    if (platform.startsWith('web')) {
        return 'web';
    }
    if (platform.startsWith('android')) {
        return 'android';
    }
    if (platform.startsWith('ios')) {
        return 'ios';
    }
    if (platform.startsWith('desktop')) {
        return 'desktop';
    }
    return 'undefined';
}

const isMobile = (p: string) => (p.startsWith('android') || p.startsWith('ios'));

@injectable()
export class PresenceModule {
    @lazyInject('PresenceLogRepository')
    private readonly logging!: PresenceLogRepository;
    readonly groups: GroupPresenceMediator = new GroupPresenceMediator();
    readonly users: UserPresenceMediator = new UserPresenceMediator();

    start = async () => {
        // Nothing to do
    }

    async setOnline(parent: Context, uid: number, tid: string, timeout: number, platform: string, active: boolean) {
        await inTx(parent, async (ctx) => {

            // TODO: Remove
            let userPresences = await Store.Presence.user.findAll(ctx, uid);
            let hasMobilePresence = !!userPresences
                .find((e) => isMobile(e.platform));
            if (!hasMobilePresence && isMobile(platform)) {
                await Modules.Hooks.onNewMobileUser(ctx, uid);
            }

            // Update presence
            let ex = await Store.Presence.findById(ctx, uid, tid);
            if (ex) {
                ex.lastSeen = Date.now();
                ex.lastSeenTimeout = timeout;
                ex.platform = platform;
                ex.active = active;
                await ex.flush(ctx);
            } else {
                ex = await Store.Presence.create(ctx, uid, tid, { lastSeen: Date.now(), lastSeenTimeout: timeout, platform, active });
            }

            // Update online state
            await this.users.setOnline(ctx, uid, tid, active, timeout);

            // Log online
            if (ex.active) {
                this.logging.logOnline(ctx, Date.now(), uid, detectPlatform(platform));
            }
        });
    }

    async getStatus(uid: number): Promise<'online' | 'never_online' | number> {
        let status = await this.users.getStatus(uid);
        if (status.type === 'online') {
            return 'online';
        } else if (status.type === 'last-seen') {
            return status.lastseen;
        } else {
            return 'never_online';
        }
    }

    isActive(uid: number): Promise<boolean> {
        return this.users.isActive(uid);
    }
}