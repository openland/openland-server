import { UserPresenceMediator } from './mediator/UserPresenceMediator';
import { GroupPresenceMediator } from './mediator/GroupPresenceMediator';
import { Store } from './../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import Timer = NodeJS.Timer;
import { injectable } from 'inversify';
import { Modules } from '../openland-modules/Modules';
import { Context, createNamedContext } from '@openland/context';
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

@injectable()
export class PresenceModule {
    @lazyInject('PresenceLogRepository')
    private readonly logging!: PresenceLogRepository;
    readonly groups: GroupPresenceMediator = new GroupPresenceMediator();
    readonly users: UserPresenceMediator = new UserPresenceMediator();

    private onlines = new Map<number, { lastSeen: number, active: boolean, timer?: Timer }>();
    private rootCtx = createNamedContext('presence');

    start = async () => {
        // tslint:disable-next-line:no-floating-promises
        (async () => {
            let supportId = await Modules.Users.getSupportUserId(this.rootCtx);
            if (supportId) {
                this.onlines.set(supportId, { lastSeen: new Date('2077-11-25T12:00:00.000Z').getTime(), active: true });
            }
        })();
    }

    async setOnline(parent: Context, uid: number, tid: string, timeout: number, platform: string, active: boolean) {
        const isMobile = (p: string) => (p.startsWith('android') || p.startsWith('ios'));
        await inTx(parent, async (ctx) => {
            let expires = Date.now() + timeout;
            let userPresences = await Store.Presence.user.findAll(ctx, uid);
            let hasMobilePresence = !!userPresences
                .find((e) => isMobile(e.platform));
            if (!hasMobilePresence && isMobile(platform)) {
                await Modules.Hooks.onNewMobileUser(ctx, uid);
            }
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
            let online = await Store.Online.findById(ctx, uid);
            if (!online) {
                await Store.Online.create(ctx, uid, { lastSeen: expires, active, activeExpires: null });
            } else if (online.lastSeen < expires) {

                let haveActivePresence = userPresences.find(p => (p.active || false) && (p.lastSeen + p.lastSeenTimeout) > Date.now());

                if (haveActivePresence) {
                    online.active = true;
                } else {
                    online.active = active;
                }
                online.lastSeen = expires;
                online.activeExpires = expires;
                await online.flush(ctx);
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