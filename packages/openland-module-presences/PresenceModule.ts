import { UserPresenceMediator } from './mediator/UserPresenceMediator';
import { GroupPresenceMediator } from './mediator/GroupPresenceMediator';
import { inTx } from '@openland/foundationdb';
import { injectable } from 'inversify';
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

@injectable()
export class PresenceModule {
    @lazyInject('PresenceLogRepository')
    readonly logging!: PresenceLogRepository;
    readonly groups: GroupPresenceMediator = new GroupPresenceMediator();
    readonly users: UserPresenceMediator = new UserPresenceMediator();

    start = async () => {
        // Nothing to do
    }

    async setOnline(parent: Context, uid: number, tid: string, timeout: number, platform: string, active: boolean) {
        await inTx(parent, async (ctx) => {

            // Update online state
            await this.users.setOnline(ctx, uid, tid, active, timeout);

            // Log online
            if (active) {
                this.logging.logOnline(ctx, Date.now(), uid, detectPlatform(platform));
            }
        });
    }

    async setOffline(parent: Context, uid: number, tid: string) {
        await inTx(parent, async (ctx) => {
            await this.users.setOffline(ctx, uid, tid);
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

    async getStatusInTx(ctx: Context, uid: number): Promise<{ lastSeen: 'online' | 'never_online' | number, isActive: boolean }> {
        let status = await this.users.getStatusInTx(ctx, uid);
        if (status.type === 'online') {
            return { lastSeen: 'online', isActive: status.active };
        } else if (status.type === 'last-seen') {
            return { lastSeen: status.lastseen, isActive: false };
        } else {
            return { lastSeen: 'never_online', isActive: false };
        }
    }

    isActive(uid: number): Promise<boolean> {
        return this.users.isActive(uid);
    }
}