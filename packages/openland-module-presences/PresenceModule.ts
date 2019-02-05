import { inTx } from 'foundation-orm/inTx';
import { FDB } from 'openland-module-db/FDB';
import Timer = NodeJS.Timer;
import { createIterator } from '../openland-utils/asyncIterator';
import { Pubsub, PubsubSubcription } from '../openland-module-pubsub/pubsub';
import { AllEntities } from '../openland-module-db/schema';
import { createHyperlogger } from 'openland-module-hyperlog/createHyperlogEvent';
import { injectable } from 'inversify';
import { createLogger } from 'openland-log/createLogger';
import { Context, createEmptyContext } from 'openland-utils/Context';
import { Modules } from '../openland-modules/Modules';

const presenceEvent = createHyperlogger<{ uid: number, online: boolean }>('presence');
const onlineStatusEvent = createHyperlogger<{ uid: number, online: boolean }>('online_status');
const log = createLogger('presences');

export interface OnlineEvent {
    userId: number;
    timeout: number;
    online: boolean;
}

@injectable()
export class PresenceModule {
    private onlines = new Map<number, { online: boolean, timer?: Timer }>();
    private fdbSubscriptions = new Map<number, { cancel: () => void }>();
    private localSub = new Pubsub<OnlineEvent>(false);
    private FDB: AllEntities = FDB;
    private onlineEventsState = new Map<number, { online: boolean, timer?: Timer }>();

    start = (fdb?: AllEntities) => {
        // Nothing to do
        if (fdb) {
            this.FDB = fdb;
        }
    }

    public async setOnline(parent: Context, uid: number, tid: string, timeout: number, platform: string, active: boolean) {
        return await inTx(parent, async (ctx) => {
            let expires = Date.now() + timeout;
            let ex = await this.FDB.Presence.findById(ctx, uid, tid);
            if (ex) {
                ex.lastSeen = Date.now();
                ex.lastSeenTimeout = timeout;
                ex.platform = platform;
            } else {
                await this.FDB.Presence.create(ctx, uid, tid, { lastSeen: Date.now(), lastSeenTimeout: timeout, platform });
            }

            let online = await this.FDB.Online.findById(ctx, uid);

            if (!online) {
                await this.FDB.Online.create(ctx, uid, { lastSeen: expires, active });
            } else if (online.lastSeen < expires) {
                online.lastSeen = expires;
                online.active = active;
            }

            await presenceEvent.event(ctx, { uid, online: true });
            await this.handleOnlineChangeLocal(ctx, uid, true, timeout);
        });
    }

    public async setOffline(parent: Context, uid: number) {
        return await inTx(parent, async (ctx) => {
            let online = await this.FDB.Online.findById(ctx, uid);
            if (online) {
                online.lastSeen = Date.now();
                online.active = false;
            }
            await presenceEvent.event(ctx, { uid, online: false });
            await this.handleOnlineChangeLocal(ctx, uid, false, 0);
        });
    }

    public async getLastSeen(ctx: Context, uid: number): Promise<'online' | 'never_online' | number> {
        log.debug(ctx, 'get last seen');
        if (uid === Modules.Users.SUPPORT_USER_ID) {
            return 'online';
        }
        let res = await this.FDB.Online.findById(ctx, uid);
        if (res) {
            if (res.lastSeen > Date.now()) {
                return 'online';
            } else {
                return res.lastSeen;
            }
        } else {
            return 'never_online';
        }
    }

    public async isActive(ctx: Context, uid: number): Promise<boolean> {
        if (uid === Modules.Users.SUPPORT_USER_ID) {
            return true;
        }
        let res = await this.FDB.Online.findById(ctx, uid);
        if (res) {
            if (res.lastSeen > Date.now()) {
                return res.active || false;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    public async createPresenceStream(uid: number, users: number[]): Promise<AsyncIterable<OnlineEvent>> {

        users = Array.from(new Set(users)); // remove duplicates

        let subscriptions: PubsubSubcription[] = [];
        let iterator = createIterator<OnlineEvent>(() => subscriptions.forEach(s => s.cancel()));

        // Send initial state
        for (let userId of users) {
            if (this.onlines.get(userId)) {
                let online = this.onlines.get(userId)!;
                iterator.push({
                    userId,
                    timeout: online.online ? 5000 : 0,
                    online: online.online
                });
            }
        }

        for (let userId of users) {
            await this.subscribeOnlineChange(userId);

            subscriptions.push(await this.localSub.subscribe(userId.toString(10), iterator.push));
        }

        return iterator;
    }

    private async handleOnlineChange(uid: number) {
        let onlineValue = await this.FDB.Online.findById(createEmptyContext(), uid);

        let timeout = 0;
        let online = false;

        if (onlineValue && onlineValue.lastSeen > Date.now()) {
            online = true;
            timeout = onlineValue.lastSeen - Date.now();
        }

        let prev = this.onlines.get(uid);

        let isChanged = online ? (!prev || !prev.online) : (prev && prev.online);

        if (prev && prev.timer) {
            clearTimeout(prev.timer);
        }

        if (online) {
            let timer = setTimeout(async () => {
                await this.localSub.publish(uid.toString(10), { userId: uid, timeout: 0, online: false });
                this.onlines.set(uid, { online: false });
            }, timeout);
            this.onlines.set(uid, { online, timer });

        } else {
            this.onlines.set(uid, { online });
        }

        if (isChanged) {
            await this.localSub.publish(uid.toString(10), { userId: uid, timeout, online });
        }
    }

    private async subscribeOnlineChange(uid: number) {
        if (this.fdbSubscriptions.has(uid)) {
            return;
        } else {
            // tslint:disable-next-line:no-floating-promises
            let sub = this.FDB.Online.watch(createEmptyContext(), uid, () => {
                log.debug(createEmptyContext(), 'presence watch fired for ' + uid);
                // tslint:disable-next-line:no-floating-promises
                this.handleOnlineChange(uid);
            });
            this.fdbSubscriptions.set(uid, sub);
        }
    }

    private async handleOnlineChangeLocal(ctx: Context, uid: number, online: boolean, timeout: number) {
        let state = this.onlineEventsState.get(uid);

        if (state && state.timer) {
            clearTimeout(state.timer);
        }

        let isChanged = online ? (!state || !state.online) : (state && state.online);

        if (online) {
            let timer = setTimeout(async () => {
                this.onlineEventsState.set(uid, { online: false });
                await onlineStatusEvent.event(ctx, { uid, online: false });
            }, timeout);
            this.onlineEventsState.set(uid, { online, timer });
        } else {
            this.onlineEventsState.set(uid, { online });
        }

        if (isChanged) {
            await onlineStatusEvent.event(ctx, { uid, online: false });
        }
    }
}