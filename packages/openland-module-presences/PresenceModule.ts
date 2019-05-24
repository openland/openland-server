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
// const onlineStatusEvent = createHyperlogger<{ uid: number, online: boolean }>('online_status');
const log = createLogger('presences');

export interface OnlineEvent {
    userId: number;
    timeout: number;
    online: boolean;
    active: boolean;
    lastSeen: number;
}

@injectable()
export class PresenceModule {
    private onlines = new Map<number, { lastSeen: number, active: boolean, timer?: Timer }>();
    private localSub = new Pubsub<OnlineEvent>(false);
    private FDB: AllEntities = FDB;

    start = (fdb?: AllEntities) => {
        // Nothing to do
        if (fdb) {
            this.FDB = fdb;
        }
        // tslint:disable-next-line:no-floating-promises
        (async () => {
            let supportId = await Modules.Users.getSupportUserId(createEmptyContext());
            if (supportId) {
                this.onlines.set(supportId, { lastSeen: new Date('2077-11-25T12:00:00.000Z').getTime(), active: true });
            }
        })();
        EventBus.subscribe(`online_change`, async (event: OnlineEvent) => {
            await this.handleOnlineChange(event);
        });
    }

    public async setOnline(parent: Context, uid: number, tid: string, timeout: number, platform: string, active: boolean) {
        await inTx(parent, async (ctx) => {
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
                let haveActivePresence = userPresences.find(p => (p.active || false) && (p.lastSeen + p.lastSeenTimeout) > Date.now());

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
            // this.onlines.set(uid, { lastSeen: expires, active: (online ? online.active : active) || false });
            let event = {
                userId: uid,
                timeout,
                online: true,
                active: (online ? online.active : active) || false,
                lastSeen: expires
            };
            await this.handleOnlineChange(event);
            resolveContext(ctx).afterTransaction(() => {
                EventBus.publish(`online_change`, event);
            });
        });
    }

    public async setOffline(parent: Context, uid: number) {
        await inTx(parent, async (ctx) => {
            let online = await this.FDB.Online.findById(ctx, uid);
            if (online) {
                online.lastSeen = Date.now();
                online.active = false;
            }
            await presenceEvent.event(ctx, { uid, online: false });
            // this.onlines.set(uid, { lastSeen: Date.now(), active: false });
            let event = {
                userId: uid,
                timeout: 0,
                online: false,
                active: false,
                lastSeen: Date.now()
            };
            await this.handleOnlineChange(event);
            resolveContext(ctx).afterTransaction(() => {
                EventBus.publish(`online_change`, event);
            });
        });
    }

    public async getLastSeen(ctx: Context, uid: number): Promise<'online' | 'never_online' | number> {
        let value: { lastSeen: number, active: boolean | null } | null | undefined;
        if (this.onlines.has(uid)) {
            value = this.onlines.get(uid);
            log.debug(ctx, 'get last seen from cache');
        } else {
            log.debug(ctx, 'get last seen from db');
            value = await this.FDB.Online.findById(ctx, uid);
            if (value) {
                this.onlines.set(uid, { lastSeen: value.lastSeen, active: value.active || false });
            } else {
                this.onlines.set(uid, { lastSeen: 0, active: false });
            }
        }
        if (value) {
            if (value.lastSeen === 0) {
                return 'never_online';
            } else if (value.lastSeen > Date.now()) {
                return 'online';
            } else {
                return value.lastSeen;
            }
        } else {
            return 'never_online';
        }
    }

    public async isActive(ctx: Context, uid: number): Promise<boolean> {
        let value: { lastSeen: number, active: boolean | null } | null | undefined;
        if (this.onlines.has(uid)) {
            value = this.onlines.get(uid);
        } else {
            value = await this.FDB.Online.findById(ctx, uid);
            if (value) {
                this.onlines.set(uid, { lastSeen: value.lastSeen, active: value.active || false });
            } else {
                this.onlines.set(uid, { lastSeen: 0, active: false });
            }
        }
        if (value) {
            if (value.lastSeen > Date.now()) {
                return value.active || false;
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
                    online: true,
                    active: true,
                    lastSeen: Date.now() + 5000
                });
            }
            if (this.onlines.get(userId)) {
                let online = this.onlines.get(userId)!;
                let isOnline = (online.lastSeen > Date.now());
                iterator.push({
                    userId,
                    timeout: isOnline ? 5000 : 0,
                    online: isOnline,
                    active: false,
                    lastSeen: Date.now() + (isOnline ? 5000 : 0)
                });
            }
        }

        for (let userId of users) {
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
            iterator.push({ userId: ev.uid, timeout: 0, online: online && online.lastSeen > Date.now() || false, active: (online && online.active || false), lastSeen: (online && online.lastSeen || Date.now())   });
            subscriptions.set(ev.uid, await this.localSub.subscribe(uid.toString(10), iterator.push));
        });
        leaveSub = EventBus.subscribe(`chat_leave_${chatId}`, (ev: { uid: number, cid: number }) => {
            iterator.push({ userId: ev.uid, timeout: 0, online: false, active: false, lastSeen: Date.now() });
            subscriptions.get(ev.uid)!.cancel();
        });

        for (let member of members) {
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

    private async handleOnlineChange(event: OnlineEvent) {
        let prev = this.onlines.get(event.userId);
        if (prev && prev.lastSeen === event.lastSeen) {
            return;
        }

        let isChanged = event.online ? (!prev || !(prev.lastSeen > Date.now())) : (prev && (prev.lastSeen > Date.now()));
        if (prev && prev.timer) {
            clearTimeout(prev.timer);
        }

        if (event.online) {
            let timer = setTimeout(async () => {
                await this.localSub.publish(event.userId.toString(10), {
                    userId: event.userId,
                    timeout: 0,
                    online: false,
                    active: false,
                    lastSeen: Date.now()
                });
            }, event.timeout);
            this.onlines.set(event.userId, { lastSeen: event.lastSeen, active: event.active, timer });
        } else {
            this.onlines.set(event.userId, { lastSeen: event.lastSeen, active: event.active });
        }

        if (isChanged) {
            await this.localSub.publish(event.userId.toString(10), event);
        }
    }
}