import os from 'os';
import { Metrics } from 'openland-module-monitoring/Metrics';
import { Modules } from 'openland-modules/Modules';
import { asyncRun, backoff } from 'openland-utils/timer';
import { Store } from 'openland-module-db/FDB';
import { PresenceRepository, PresenceType } from './../repo/PresenceRepository';
import { inTx, getTransaction } from '@openland/foundationdb';
import { Context, createNamedContext } from '@openland/context';
import { EventBus, EventBusSubcription } from 'openland-module-pubsub/EventBus';
import { PushableIterator, createIterator } from 'openland-utils/asyncIterator';

const rootCtx = createNamedContext('presence');
const TIMEOUT = 60 * 1000;
const hostname = os.hostname();

export type UserOnlineStatus = ({ type: 'never-online' } | { type: 'online', active: boolean, timeout: number } | { type: 'last-seen', lastseen: number }) & { uid: number };

function convertOnlineStatus(src: PresenceType, uid: number): UserOnlineStatus {
    let now = Date.now();
    let res: UserOnlineStatus;
    if (src.lastSeen) {
        if (src.lastSeen.timeout < now) {
            res = { type: 'last-seen', lastseen: src.lastSeen.date, uid };
        } else {
            res = { type: 'online', active: (src.lastActive && src.lastActive.timeout > now) || false, timeout: src.lastSeen.timeout, uid };
        }
    } else {
        res = { type: 'never-online', uid };
    }
    return res;
}

type UserSubscription = {
    completed: boolean,
    uid: number,
    state: PresenceType | null,
    lastSeenTimer: NodeJS.Timer | null,
    lastActiveTimer: NodeJS.Timer | null,
    subscription: EventBusSubcription | null,
    iterators: PushableIterator<UserOnlineStatus>[],
    resolvers: ((value: UserOnlineStatus) => void)[],
    timer: NodeJS.Timer | null
};

export class UserPresenceMediator {

    readonly repo: PresenceRepository = new PresenceRepository(Store.UserOnlineDirectory);

    private readonly activeUserSubscriptions = new Map<number, UserSubscription>();

    private getOrCreateSubscription(uid: number): UserSubscription {
        let active = this.activeUserSubscriptions.get(uid);
        if (active) {
            return active;
        }

        let state: UserSubscription = {
            completed: false,
            uid,
            state: null,
            subscription: null,
            timer: null,
            lastSeenTimer: null,
            lastActiveTimer: null,
            iterators: [],
            resolvers: []
        };

        let notifyState = () => {
            if (state.state) {
                let status: UserOnlineStatus = convertOnlineStatus(state.state, uid);
                for (let i of state.iterators) {
                    i.push(status);
                }
                for (let r of state.resolvers) {
                    r(status);
                }
                state.resolvers = [];

                if (!state.timer && state.iterators.length === 0 && state.resolvers.length === 0) {
                    state.timer = setTimeout(() => {
                        this.cleanupSubscription(uid);
                    }, TIMEOUT);
                }
            }
        };

        let handleUpdate = (presence: PresenceType) => {

            // Clear timers
            if (state.lastSeenTimer) {
                clearTimeout(state.lastSeenTimer);
                state.lastSeenTimer = null;
            }
            if (state.lastActiveTimer) {
                clearTimeout(state.lastActiveTimer);
                state.lastActiveTimer = null;
            }

            // Update and notify
            state.state = presence;
            notifyState();

            // Create timers
            let now = Date.now();
            if (presence.lastActive) {
                let timeout = presence.lastActive.timeout;
                if (timeout > now) {
                    state.lastActiveTimer = setTimeout(notifyState, timeout - now);
                }
            }
            if (presence.lastSeen) {
                let timeout = presence.lastSeen.timeout;
                if (timeout > now) {
                    state.lastSeenTimer = setTimeout(notifyState, timeout - now);
                }
            }
        };

        // Create subscription
        state.subscription = EventBus.subscribe(`presences.user.${uid}`, (data) => {
            if (state.completed) {
                return;
            }
            let presence = data as PresenceType;
            handleUpdate(presence);
        });

        // Load initial value
        asyncRun(async () => {
            await backoff(rootCtx, async () => {
                if (state.completed || state.state !== null) {
                    return;
                }
                let status = await inTx(rootCtx, async (ctx) => await Modules.Presence.users.repo.getOnline(ctx, uid));
                if (state.completed || state.state !== null) {
                    return;
                }
                handleUpdate(status);
            });
        });

        // Start timer since there are zero listeners
        state.timer = setTimeout(() => {
            this.cleanupSubscription(uid);
        }, TIMEOUT);

        // Save state
        this.activeUserSubscriptions.set(uid, state);
        Metrics.UserPresenceSubscriptions.inc(hostname);

        return state;
    }

    private cleanupSubscription(uid: number) {
        let active = this.activeUserSubscriptions.get(uid);
        if (active) {

            // Check if we could cleanup subscription
            if (active.iterators.length > 0 || active.resolvers.length > 0) {
                throw Error('Unable to perform cleanup: some iterators or ressolvers are outstanding');
            }

            // Mark as completed
            active.completed = true;

            // Cancel subscription
            if (active.subscription) {
                active.subscription.cancel();
                active.subscription = null;
            }

            // Clear timers
            if (active.timer) {
                clearTimeout(active.timer);
                active.timer = null;
            }
            if (active.lastActiveTimer) {
                clearTimeout(active.lastActiveTimer);
                active.lastActiveTimer = null;
            }
            if (active.lastSeenTimer) {
                clearTimeout(active.lastSeenTimer);
                active.lastSeenTimer = null;
            }

            // Remove from active collection
            this.activeUserSubscriptions.delete(uid);
            Metrics.UserPresenceSubscriptions.dec(hostname);
        }
    }

    createPresenceStream(uids: number[]): AsyncIterable<UserOnlineStatus> {
        let subscriptions = uids.map((u) => this.getOrCreateSubscription(u));
        let iterator = createIterator<UserOnlineStatus>();

        // Register
        for (let s of subscriptions) {
            if (s.timer) {
                clearTimeout(s.timer);
                s.timer = null;
            }
            s.iterators.push(iterator);
        }

        // Unregister
        iterator.onExit = () => {
            for (let s of subscriptions) {
                let existing = s.iterators.findIndex((v) => v === iterator);
                if (existing >= 0) {
                    s.iterators.splice(existing, 1);
                    if (s.iterators.length === 0 && s.resolvers.length === 0) {
                        s.timer = setTimeout(() => {
                            this.cleanupSubscription(s.uid);
                        }, TIMEOUT);
                    }
                }
            }
        };

        // Push initial value
        for (let s of subscriptions) {
            let state = s.state;
            if (state) {
                iterator.push(convertOnlineStatus(state, s.uid));
            }
        }

        return iterator;
    }

    async getStatus(uid: number): Promise<UserOnlineStatus> {
        let subscription = this.getOrCreateSubscription(uid);
        if (subscription.state !== null) {
            return convertOnlineStatus(subscription.state, uid);
        }
        return await new Promise<UserOnlineStatus>((resolve) => {
            if (subscription.timer) {
                clearTimeout(subscription.timer);
                subscription.timer = null;
            }
            subscription.resolvers.push(resolve);
        });
    }

    async isActive(uid: number) {
        let res = await this.getStatus(uid);
        return res.type === 'online' && res.active;
    }

    //
    // Mutations
    //

    async setOnline(parent: Context, uid: number, tid: string, active: boolean, timeout: number) {
        await inTx(parent, async (ctx) => {
            let now = Date.now();
            await this.repo.setOnline(ctx, uid, tid, now, now + timeout, active);
            getTransaction(ctx).afterCommit(() => {
                EventBus.publish(`presences.users-notify.${uid}`, {});
            });
        });
    }

    async setOffline(parent: Context, uid: number, tid: string) {
        await inTx(parent, async (ctx) => {
            let now = Date.now();
            await this.repo.setOffline(ctx, uid, tid, now);
            getTransaction(ctx).afterCommit(() => {
                EventBus.publish(`presences.users-notify.${uid}`, {});
            });
        });
    }
}