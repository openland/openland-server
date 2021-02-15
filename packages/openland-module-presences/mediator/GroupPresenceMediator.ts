import os from 'os';
import { Metrics } from 'openland-module-monitoring/Metrics';
import { Modules } from 'openland-modules/Modules';
import { createIterator, PushableIterator } from 'openland-utils/asyncIterator';
import { createNamedContext } from '@openland/context';
import { asyncRun, backoff } from 'openland-utils/timer';
import { EventBusSubcription, EventBus } from 'openland-module-pubsub/EventBus';

const rootCtx = createNamedContext('presence');
const TIMEOUT = 60 * 1000;
const hostname = os.hostname();

type GroupSubscription = {
    completed: boolean,
    count: number | null,
    subscription: EventBusSubcription | null,
    iterators: PushableIterator<{ onlineMembers: number }>[],
    resolvers: ((value: number) => void)[],
    timer: NodeJS.Timer | null
};

export class GroupPresenceMediator {

    private readonly activeGroupSubscriptions = new Map<number, GroupSubscription>();

    private getOrCreateSubscription(cid: number): GroupSubscription {
        let active = this.activeGroupSubscriptions.get(cid);
        if (active) {
            return active;
        }

        let state: GroupSubscription = {
            completed: false,
            count: null,
            subscription: null,
            timer: null,
            iterators: [],
            resolvers: []
        };

        // Create subscription
        state.subscription = EventBus.subscribe(`presences.group.${cid}`, (data) => {
            if (state.completed) {
                return;
            }
            let online = data.online as number;
            state.count = online;
            for (let i of state.iterators) {
                i.push({ onlineMembers: online });
            }
            for (let r of state.resolvers) {
                r(online);
            }
            state.resolvers = [];

            if (!state.timer && state.iterators.length === 0 && state.resolvers.length === 0) {
                state.timer = setTimeout(() => {
                    this.cleanupSubscription(cid);
                }, TIMEOUT);
            }
        });

        // Load initial value
        asyncRun(async () => {
            await backoff(rootCtx, async () => {
                if (state.completed || state.count !== null) {
                    return;
                }
                let online = await Modules.Events.groupService.getOnline(cid);
                if (state.completed || state.count !== null) {
                    return;
                }
                state.count = online;
                for (let i of state.iterators) {
                    i.push({ onlineMembers: online });
                }
                for (let r of state.resolvers) {
                    r(online);
                }
                state.resolvers = [];

                if (!state.timer && state.iterators.length === 0 && state.resolvers.length === 0) {
                    state.timer = setTimeout(() => {
                        this.cleanupSubscription(cid);
                    }, TIMEOUT);
                }
            });
        });

        // Start timer since there are zero listeners
        state.timer = setTimeout(() => {
            this.cleanupSubscription(cid);
        }, TIMEOUT);

        // Save state
        this.activeGroupSubscriptions.set(cid, state);
        Metrics.GroupPresenceSubscriptions.inc(hostname);

        return state;
    }

    private cleanupSubscription(cid: number) {
        let active = this.activeGroupSubscriptions.get(cid);
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

            // Remove from active collection
            this.activeGroupSubscriptions.delete(cid);
            Metrics.GroupPresenceSubscriptions.dec(hostname);
        }
    }

    createPresenceStream(cid: number): AsyncIterable<{ onlineMembers: number }> {

        let subscription = this.getOrCreateSubscription(cid);
        let iterator = createIterator<{ onlineMembers: number }>();

        // Register
        if (subscription.timer) {
            clearTimeout(subscription.timer);
            subscription.timer = null;
        }
        subscription.iterators.push(iterator);

        // Unregister
        iterator.onExit = () => {
            let existing = subscription.iterators.findIndex((v) => v === iterator);
            if (existing >= 0) {
                subscription.iterators.splice(existing, 1);
                if (subscription.iterators.length === 0 && subscription.resolvers.length === 0) {
                    subscription.timer = setTimeout(() => {
                        this.cleanupSubscription(cid);
                    }, TIMEOUT);
                }
            }
        };

        // Push initial value
        if (subscription.count !== null) {
            iterator.push({ onlineMembers: subscription.count });
        }

        return iterator;
    }

    async getOnline(cid: number) {
        let subscription = this.getOrCreateSubscription(cid);
        if (subscription.count !== null) {
            return subscription.count;
        }
        return await new Promise<number>((resolve) => {
            if (subscription.timer) {
                clearTimeout(subscription.timer);
                subscription.timer = null;
            }
            subscription.resolvers.push(resolve);
        });
    }
}