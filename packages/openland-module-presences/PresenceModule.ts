import { Events } from 'openland-module-hyperlog/Events';
import { Store } from './../openland-module-db/FDB';
import { inTx, withReadOnlyTransaction } from '@openland/foundationdb';
import Timer = NodeJS.Timer;
import { createIterator } from '../openland-utils/asyncIterator';
import { Pubsub, PubsubSubcription } from '../openland-module-pubsub/pubsub';
import { injectable } from 'inversify';
import { Modules } from '../openland-modules/Modules';
import { EventBus } from '../openland-module-pubsub/EventBus';
import { perf } from '../openland-utils/perf';
import { Context, createNamedContext } from '@openland/context';
import { getTransaction } from '@openland/foundationdb';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { registerPresenceService } from './service/registerPresenceService';
import { PresenceLogRepository } from './PresenceLogRepository';
import { lazyInject } from 'openland-modules/Modules.container';

export interface OnlineEvent {
    userId: number;
    timeout: number;
    online: boolean;
    active: boolean;
    lastSeen: number;
}

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

    private onlines = new Map<number, { lastSeen: number, active: boolean, timer?: Timer }>();
    private localSub = new Pubsub<OnlineEvent>(false);
    private rootCtx = createNamedContext('presence');

    start = async () => {
        // tslint:disable-next-line:no-floating-promises
        (async () => {
            let supportId = await Modules.Users.getSupportUserId(this.rootCtx);
            if (supportId) {
                this.onlines.set(supportId, { lastSeen: new Date('2077-11-25T12:00:00.000Z').getTime(), active: true });
            }
        })();
        EventBus.subscribe(`online_change`, async (event: OnlineEvent) => {
            await this.handleOnlineChange(event);
        });

        if (serverRoleEnabled('workers')) {
            registerPresenceService();
        }
    }

    public async setOnline(parent: Context, uid: number, tid: string, timeout: number, platform: string, active: boolean) {
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
            if (ex.active) {
                this.logging.logOnline(ctx, Date.now(), uid, detectPlatform(platform));
            }
            // this.onlines.set(uid, { lastSeen: expires, active: (online ? online.active : active) || false });
            let event = {
                userId: uid,
                timeout,
                online: true,
                active: (online ? online.active : active) || false,
                lastSeen: expires
            };
            await this.handleOnlineChange(event);
            getTransaction(ctx).afterCommit(() => {
                EventBus.publish(`online_change`, event);
            });
        });
    }

    public async setOffline(parent: Context, uid: number) {
        await inTx(parent, async (ctx) => {
            let online = await Store.Online.findById(ctx, uid);
            if (online) {
                online.lastSeen = Date.now();
                online.active = false;
            }
            Events.PresenceEvent.event(ctx, { uid, platform: null, online: false });
            // this.onlines.set(uid, { lastSeen: Date.now(), active: false });
            let event = {
                userId: uid,
                timeout: 0,
                online: false,
                active: false,
                lastSeen: Date.now()
            };
            await this.handleOnlineChange(event);
            getTransaction(ctx).afterCommit(() => {
                EventBus.publish(`online_change`, event);
            });
        });
    }

    public async getLastSeen(ctx: Context, uid: number): Promise<'online' | 'never_online' | number> {
        let value: { lastSeen: number, active: boolean | null } | null | undefined;
        if (this.onlines.has(uid)) {
            value = this.onlines.get(uid);
        } else {
            value = await Store.Online.findById(ctx, uid);
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
            value = await Store.Online.findById(ctx, uid);
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
        await inTx(this.rootCtx, async (ctx) => {
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
        });

        for (let userId of users) {
            subscriptions.push(await this.localSub.subscribe(userId.toString(10), iterator.push));
        }

        return iterator;
    }

    public async createChatPresenceStream(uid: number, chatId: number): Promise<AsyncIterable<OnlineEvent>> {
        let ctx = withReadOnlyTransaction(this.rootCtx);
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
            let online = await Store.Online.findById(withReadOnlyTransaction(this.rootCtx), ev.uid);
            iterator.push({ userId: ev.uid, timeout: 0, online: online && online.lastSeen > Date.now() || false, active: (online && online.active || false), lastSeen: (online && online.lastSeen || Date.now()) });
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
        let ctx = withReadOnlyTransaction(this.rootCtx);
        await Modules.Messaging.room.checkAccess(ctx, uid, chatId);
        let members = (await Modules.Messaging.room.findConversationMembers(ctx, chatId));
        let stream = await this.createChatPresenceStream(uid, chatId);
        let onlineMembers = new Set<number>();
        let prevValue = 0;

        let membersOnline = await Promise.all(members.map(m => Store.Online.findById(ctx, m)));
        for (let online of membersOnline) {
            if (online && online.lastSeen > Date.now()) {
                onlineMembers.add(online.uid);
            }
        }

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