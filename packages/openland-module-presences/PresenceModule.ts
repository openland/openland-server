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
import { EventBus } from '../openland-module-pubsub/EventBus';
import { perf } from '../openland-utils/perf';
import { resolveContext } from '../foundation-orm/utils/contexts';

const presenceEvent = createHyperlogger<{ uid: number, online: boolean }>('presence');
const onlineStatusEvent = createHyperlogger<{ uid: number, online: boolean }>('online_status');
const log = createLogger('presences');

export interface OnlineEvent {
    userId: number;
    timeout: number;
    online: boolean;
}

interface IPresenceModule {
    start(fdb?: AllEntities): void;
    setOnline(parent: Context, uid: number, tid: string, timeout: number, platform: string, active: boolean): Promise<void>;
    setOffline(parent: Context, uid: number): Promise<void>;
    getLastSeen(ctx: Context, uid: number): Promise<'online' | 'never_online' | number>;
    isActive(ctx: Context, uid: number): Promise<boolean>;
    createPresenceStream(uid: number, users: number[]): Promise<AsyncIterable<OnlineEvent>>;
    createChatPresenceStream(uid: number, chatId: number): Promise<AsyncIterable<OnlineEvent>>;
    createChatOnlineCountStream(uid: number, chatId: number): AsyncIterable<{ onlineMembers: number }>;
}

@injectable()
export class PresenceModuleFDBImpl implements IPresenceModule {
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
                ex.active = active;
                await ex.flush();
            } else {
                await this.FDB.Presence.create(ctx, uid, tid, { lastSeen: Date.now(), lastSeenTimeout: timeout, platform, active });
            }

            let online = await this.FDB.Online.findById(ctx, uid);

            if (!online) {
                await this.FDB.Online.create(ctx, uid, { lastSeen: expires, active });
            } else if (online.lastSeen < expires) {
                let userPresences = await this.FDB.Presence.allFromUser(ctx, uid);
                let haveActivePresence = userPresences.find(p => (p.active || false) && (p.lastSeen + p.lastSeenTimeout) > Date.now() );

                if (haveActivePresence) {
                    online.active = true;
                    online.activeExpires = expires;
                } else {
                    online.active = active;
                }
                online.lastSeen = expires;
                online.activeExpires = expires;
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
        if (uid === await Modules.Users.getSupportUserId(ctx)) {
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
        if (uid === await Modules.Users.getSupportUserId(ctx)) {
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
        let ctx = createEmptyContext();
        for (let userId of users) {
            if (userId === await Modules.Users.getSupportUserId(ctx)) {
                iterator.push({
                    userId,
                    timeout: 0,
                    online: true
                });
            }
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

    public async createChatPresenceStream(uid: number, chatId: number): Promise<AsyncIterable<OnlineEvent>> {
        let ctx = createEmptyContext();
        await Modules.Messaging.room.checkAccess(ctx, uid, chatId);
        let members = await perf('presence_members', async () => (await Modules.Messaging.room.findConversationMembers(ctx, chatId)));

        let joinSub: PubsubSubcription;
        let leaveSub: PubsubSubcription;
        let subscriptions = new Map<number, PubsubSubcription>();

        let iterator = createIterator<OnlineEvent>(() => {
            subscriptions.forEach(s => s.cancel());
            joinSub.cancel();
            leaveSub.cancel();
        });

        joinSub = EventBus.subscribe(`chat_join_${chatId}`, async (ev: { uid: number, cid: number }) => {
            let online = await FDB.Online.findById(ctx, ev.uid);
            iterator.push({ userId: ev.uid, timeout: 0, online: online && online.lastSeen > Date.now() || false });
            await this.subscribeOnlineChange(uid);
            subscriptions.set(ev.uid, await this.localSub.subscribe(uid.toString(10), iterator.push));
        });
        leaveSub = EventBus.subscribe(`chat_leave_${chatId}`, (ev: { uid: number, cid: number }) => {
            iterator.push({ userId: ev.uid, timeout: 0, online: false });
            subscriptions.get(ev.uid)!.cancel();
        });

        for (let member of members) {
            // let online = await FDB.Online.findById(ctx, member);
            // iterator.push({ userId: member, timeout: 0, online: online && online.lastSeen > Date.now() || false });
            await this.subscribeOnlineChange(member);
            subscriptions.set(member, await this.localSub.subscribe(member.toString(10), iterator.push));
        }

        return iterator;
    }

    public async * createChatOnlineCountStream(uid: number, chatId: number): AsyncIterable<{ onlineMembers: number }> {
        let ctx = createEmptyContext();
        await Modules.Messaging.room.checkAccess(ctx, uid, chatId);
        let members = (await Modules.Messaging.room.findConversationMembers(ctx, chatId));
        let stream = await this.createChatPresenceStream(uid, chatId);
        let onlineMembers = new Set<number>();
        let prevValue = 0;

        await perf('presence_init_state', async () => {
            let membersOnline = await Promise.all(members.map(m => FDB.Online.findById(ctx, m)));
            for (let online of membersOnline) {
                if (online && online.lastSeen > Date.now()) {
                    onlineMembers.add(online.uid);
                }
            }
        });

        // send initial state
        yield { onlineMembers: onlineMembers.size };
        prevValue = onlineMembers.size;

        for await (let event of stream) {
            if (event.online) {
                onlineMembers.add(event.userId);
            } else {
                onlineMembers.delete(event.userId);
            }
            if (prevValue !== onlineMembers.size) {
                yield { onlineMembers: onlineMembers.size };
                prevValue = onlineMembers.size;
            }
        }
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

@injectable()
export class PresenceModuleRedisImpl implements IPresenceModule {
    private onlines = new Map<number, { online: boolean, timer?: Timer }>();
    private redisSubscriptions = new Map<number, { cancel: () => void }>();
    private localSub = new Pubsub<OnlineEvent>(false);
    private FDB: AllEntities = FDB;

    start = (fdb?: AllEntities) => {
        // Nothing to do
        if (fdb) {
            this.FDB = fdb;
        }
    }

    public async setOnline(parent: Context, uid: number, tid: string, timeout: number, platform: string, active: boolean) {
        await inTx(parent, async (ctx) => {
            resolveContext(ctx).afterTransaction(() => {
                EventBus.publish(`online_change_${uid}`, { });
            });

            let expires = Date.now() + timeout;
            let ex = await this.FDB.Presence.findById(ctx, uid, tid);
            if (ex) {
                ex.lastSeen = Date.now();
                ex.lastSeenTimeout = timeout;
                ex.platform = platform;
                ex.active = active;
                await ex.flush();
            } else {
                await this.FDB.Presence.create(ctx, uid, tid, { lastSeen: Date.now(), lastSeenTimeout: timeout, platform, active });
            }

            let online = await this.FDB.Online.findById(ctx, uid);

            if (!online) {
                await this.FDB.Online.create(ctx, uid, { lastSeen: expires, active });
            } else if (online.lastSeen < expires) {
                let userPresences = await this.FDB.Presence.allFromUser(ctx, uid);
                let haveActivePresence = userPresences.find(p => (p.active || false) && (p.lastSeen + p.lastSeenTimeout) > Date.now() );

                if (haveActivePresence) {
                    online.active = true;
                    online.activeExpires = expires;
                } else {
                    online.active = active;
                }
                online.lastSeen = expires;
                online.activeExpires = expires;
                await online.flush();
            }

            await presenceEvent.event(ctx, { uid, online: true });
        });
    }

    public async setOffline(parent: Context, uid: number) {
        await inTx(parent, async (ctx) => {
            resolveContext(ctx).afterTransaction(() => {
                EventBus.publish(`online_change_${uid}`, { });
            });

            let online = await this.FDB.Online.findById(ctx, uid);
            if (online) {
                online.lastSeen = Date.now();
                online.active = false;
            }
            await presenceEvent.event(ctx, { uid, online: false });
        });
    }

    public async getLastSeen(ctx: Context, uid: number): Promise<'online' | 'never_online' | number> {
        log.debug(ctx, 'get last seen');
        if (uid === await Modules.Users.getSupportUserId(ctx)) {
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
        if (uid === await Modules.Users.getSupportUserId(ctx)) {
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
        let ctx = createEmptyContext();
        for (let userId of users) {
            if (userId === await Modules.Users.getSupportUserId(ctx)) {
                iterator.push({
                    userId,
                    timeout: 0,
                    online: true
                });
            }
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

    public async createChatPresenceStream(uid: number, chatId: number): Promise<AsyncIterable<OnlineEvent>> {
        let ctx = createEmptyContext();
        await Modules.Messaging.room.checkAccess(ctx, uid, chatId);
        let members = await perf('presence_members', async () => (await Modules.Messaging.room.findConversationMembers(ctx, chatId)));

        let joinSub: PubsubSubcription;
        let leaveSub: PubsubSubcription;
        let subscriptions = new Map<number, PubsubSubcription>();

        let iterator = createIterator<OnlineEvent>(() => {
            subscriptions.forEach(s => s.cancel());
            joinSub.cancel();
            leaveSub.cancel();
        });

        joinSub = EventBus.subscribe(`chat_join_${chatId}`, async (ev: { uid: number, cid: number }) => {
            let online = await FDB.Online.findById(ctx, ev.uid);
            iterator.push({ userId: ev.uid, timeout: 0, online: online && online.lastSeen > Date.now() || false });
            await this.subscribeOnlineChange(uid);
            subscriptions.set(ev.uid, await this.localSub.subscribe(uid.toString(10), iterator.push));
        });
        leaveSub = EventBus.subscribe(`chat_leave_${chatId}`, (ev: { uid: number, cid: number }) => {
            iterator.push({ userId: ev.uid, timeout: 0, online: false });
            subscriptions.get(ev.uid)!.cancel();
        });

        for (let member of members) {
            // let online = await FDB.Online.findById(ctx, member);
            // iterator.push({ userId: member, timeout: 0, online: online && online.lastSeen > Date.now() || false });
            await this.subscribeOnlineChange(member);
            subscriptions.set(member, await this.localSub.subscribe(member.toString(10), iterator.push));
        }

        return iterator;
    }

    public async * createChatOnlineCountStream(uid: number, chatId: number): AsyncIterable<{ onlineMembers: number }> {
        let ctx = createEmptyContext();
        await Modules.Messaging.room.checkAccess(ctx, uid, chatId);
        let members = (await Modules.Messaging.room.findConversationMembers(ctx, chatId));
        let stream = await this.createChatPresenceStream(uid, chatId);
        let onlineMembers = new Set<number>();
        let prevValue = 0;

        await perf('presence_init_state', async () => {
            let membersOnline = await Promise.all(members.map(m => FDB.Online.findById(ctx, m)));
            for (let online of membersOnline) {
                if (online && online.lastSeen > Date.now()) {
                    onlineMembers.add(online.uid);
                }
            }
        });

        // send initial state
        yield { onlineMembers: onlineMembers.size };
        prevValue = onlineMembers.size;

        for await (let event of stream) {
            if (event.online) {
                onlineMembers.add(event.userId);
            } else {
                onlineMembers.delete(event.userId);
            }
            if (prevValue !== onlineMembers.size) {
                yield { onlineMembers: onlineMembers.size };
                prevValue = onlineMembers.size;
            }
        }
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
        if (this.redisSubscriptions.has(uid)) {
            return;
        } else {
            this.redisSubscriptions.set(uid, await EventBus.subscribe(`online_change_${uid}`, event => {
                // tslint:disable-next-line:no-floating-promises
                this.handleOnlineChange(uid);
            }));
        }
    }
}

export { PresenceModuleRedisImpl as PresenceModule };
