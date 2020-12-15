import { Context } from '@openland/context';
import { encoders, Subspace } from '@openland/foundationdb';
// import { createLogger } from '@openland/log';
import { AtomicSubspace } from 'openland-module-db/AtomicSubspace';
import { CachedSubspace } from 'openland-module-db/CachedSubspace';
import { ConversationCountersState, UserCounterState, UserCounterAsyncSubscriptions } from 'openland-module-db/structs';

const DIRECT_SUBSCRIBER_LIMIT = 50;
const SUBSPACE_CONVERSATION = 0;
const SUBSPACE_USER = 1;
const SUBSPACE_USER_STATE = 0;
const SUBSPACE_USER_ASYNC = 2;
const SUBSPACE_USER_COUNTERS = 3;

const TYPE_NORMAL = 0;
const TYPE_DISTINCT = 1;
const TYPE_NORMAL_NO_MUTED = 2;
const TYPE_DISTINCT_NO_MUTED = 3;
const COUNTER_ALL = 0;
const COUNTER_MENTIONS = 1;

// const logger = createLogger('counters');

export class CounterSubscribersDirectory {
    readonly subspace: Subspace;
    readonly conversations: CachedSubspace<ConversationCountersState>;
    readonly users: CachedSubspace<UserCounterState>;
    readonly usersAsync: CachedSubspace<UserCounterAsyncSubscriptions>;
    readonly userCounters: AtomicSubspace;

    constructor(subspace: Subspace) {
        this.subspace = subspace;
        this.conversations = new CachedSubspace(
            subspace.subspace(encoders.tuple.pack([SUBSPACE_CONVERSATION])),
            (src) => Buffer.from(ConversationCountersState.encode(src).finish()),
            (src) => ConversationCountersState.decode(src)
        );
        this.users = new CachedSubspace(
            subspace.subspace(encoders.tuple.pack([SUBSPACE_USER, SUBSPACE_USER_STATE])),
            (src) => Buffer.from(UserCounterState.encode(src).finish()),
            (src) => UserCounterState.decode(src)
        );
        this.usersAsync = new CachedSubspace(
            subspace.subspace(encoders.tuple.pack([SUBSPACE_USER, SUBSPACE_USER_ASYNC])),
            (src) => Buffer.from(UserCounterAsyncSubscriptions.encode(src).finish()),
            (src) => UserCounterAsyncSubscriptions.decode(src)
        );
        this.userCounters = new AtomicSubspace(
            subspace.subspace(encoders.tuple.pack([SUBSPACE_USER, SUBSPACE_USER_COUNTERS]))
        );
    }

    async subscribe(ctx: Context, args: { uid: number, cid: number, seq: number, counter: number, mentions: number, muted: boolean }) {
        let existing = await this.users.read(ctx, [args.uid, args.cid]);
        // logger.log(ctx, 'subscribe', args, existing);

        if (existing) {

            // Update existing
            if (existing.async) {
                this.users.write(ctx, [args.uid, args.cid], new UserCounterState({
                    seq: args.seq,
                    muted: args.muted,
                    async: true
                }));
                return;
            }

            // Update counter
            let newState = new UserCounterState({
                seq: args.seq,
                muted: args.muted,
                async: false,
                counter: args.counter,
                mentions: args.mentions
            });
            this.users.write(ctx, [args.uid, args.cid], newState);
            this.substractCounters(ctx, args.uid, existing);
            this.addCounters(ctx, args.uid, newState);
            return;
        }

        // Read existing subscribers
        let existingSubscribers = (await this.getDirectSubscribers(ctx, args.cid));

        if (existingSubscribers.length > DIRECT_SUBSCRIBER_LIMIT) {
            // logger.log(ctx, 'add-async-subsccribe');

            // Add async subscription
            let asyncSubscriptions = await this.getAsyncSubscriptions(ctx, args.uid);
            this.usersAsync.write(ctx, [args.uid], new UserCounterAsyncSubscriptions({
                subscriptions: [
                    ...asyncSubscriptions,
                    {
                        cid: args.cid,
                        muted: args.muted,
                        seq: args.seq
                    }
                ]
            }));

            // Update subscription state
            let newState = new UserCounterState({
                seq: args.seq,
                muted: args.muted,
                async: true
            });
            this.users.write(ctx, [args.uid, args.cid], newState);

        } else {
            // logger.log(ctx, 'add-direct-subsccribe');

            // Add direct subscriber
            let directSubscribers = await this.getDirectSubscribers(ctx, args.cid);
            this.conversations.write(ctx, [args.cid], new ConversationCountersState({ direct: [...directSubscribers, args.uid] }));

            // Update counters
            let newState = new UserCounterState({
                seq: args.seq,
                muted: args.muted,
                async: false,
                counter: args.counter,
                mentions: args.mentions
            });
            this.users.write(ctx, [args.uid, args.cid], newState);
            this.addCounters(ctx, args.uid, newState);
        }

        // logger.log(ctx, 'end');
    }

    async unsubscribe(ctx: Context, args: { uid: number, cid: number }) {
        let existing = await this.users.read(ctx, [args.uid, args.cid]);
        if (!existing) {
            return;
        }

        // Delete state
        this.users.write(ctx, [args.uid, args.cid], null);

        // Remove async subscription
        if (existing.async) {
            let asyncSubscriptions = await this.getAsyncSubscriptions(ctx, args.uid);
            this.usersAsync.write(ctx, [args.uid], new UserCounterAsyncSubscriptions({
                subscriptions: asyncSubscriptions.filter((v) => v.cid !== args.cid)
            }));
            return;
        }

        // Remove direct subscriber
        let directSubscribers = await this.getDirectSubscribers(ctx, args.cid);
        this.conversations.write(ctx, [args.cid], new ConversationCountersState({ direct: directSubscribers.filter((v) => v !== args.uid) }));

        // Update counters
        this.substractCounters(ctx, args.uid, existing);
    }

    async readState(ctx: Context, args: { cid: number, uid: number }) {
        let existing = await this.users.read(ctx, [args.uid, args.cid]);
        // if (!existing) {
        //     throw Error('Internal error');
        // }
        return existing;
    }

    async readAllStates(ctx: Context, uid: number) {
        return await Promise.all((await this.users.readPrefixed(ctx, [uid])).map(async (key) => ({ cid: key[1] as number, uid: key[0] as number, state: (await this.users.read(ctx, key))! })));
    }

    async updateDirect(ctx: Context, args: { cid: number, uid: number, counter: number, mentions: number }) {
        let existing = await this.users.read(ctx, [args.uid, args.cid]);
        if (!existing) {
            throw Error('Internal error');
        }

        if (existing.async) {
            throw Error('Internal error');
        }

        // Update counter
        let newState = new UserCounterState({
            seq: existing.seq,
            muted: existing.muted,
            async: false,
            counter: args.counter,
            mentions: args.mentions
        });
        this.users.write(ctx, [args.uid, args.cid], newState);
        this.substractCounters(ctx, args.uid, existing);
        this.addCounters(ctx, args.uid, newState);
    }

    async getCounter(ctx: Context, uid: number, excludeMuted: boolean, counter: 'all' | 'distinct' | 'all-mentions' | 'distinct-mentions') {
        if (excludeMuted) {
            if (counter === 'all') {
                return await this.userCounters.get(ctx, [uid, TYPE_NORMAL_NO_MUTED, COUNTER_ALL]);
            } else if (counter === 'distinct') {
                return await this.userCounters.get(ctx, [uid, TYPE_DISTINCT_NO_MUTED, COUNTER_ALL]);
            } else if (counter === 'all-mentions') {
                return await this.userCounters.get(ctx, [uid, TYPE_NORMAL_NO_MUTED, COUNTER_MENTIONS]);
            } else if (counter === 'distinct-mentions') {
                return await this.userCounters.get(ctx, [uid, TYPE_DISTINCT_NO_MUTED, COUNTER_MENTIONS]);
            } else {
                throw Error('Unknowwn counter type ' + counter);
            }
        }

        if (counter === 'all') {
            return await this.userCounters.get(ctx, [uid, TYPE_NORMAL, COUNTER_ALL]);
        } else if (counter === 'distinct') {
            return await this.userCounters.get(ctx, [uid, TYPE_DISTINCT, COUNTER_ALL]);
        } else if (counter === 'all-mentions') {
            return await this.userCounters.get(ctx, [uid, TYPE_NORMAL, COUNTER_MENTIONS]);
        } else if (counter === 'distinct-mentions') {
            return await this.userCounters.get(ctx, [uid, TYPE_DISTINCT, COUNTER_MENTIONS]);
        } else {
            throw Error('Unknowwn counter type ' + counter);
        }
    }

    /**
     * Returns direct subscribers of conversation
     * @param ctx context
     * @param cid conversation id
     */
    async getDirectSubscribers(ctx: Context, cid: number): Promise<number[]> {
        let ex = await this.conversations.read(ctx, [cid]);
        if (ex) {
            return ex.direct;
        }
        return [];
    }

    /**
     * Returns async subscriptions of a user
     * @param ctx context
     * @param uid user id 
     */
    async getAsyncSubscriptions(ctx: Context, uid: number): Promise<{ cid: number, muted: boolean, seq: number }[]> {
        let ex = await this.usersAsync.read(ctx, [uid]);
        if (ex) {
            return ex.subscriptions;
        }
        return [];
    }

    async setCounters(ctx: Context, uid: number, counters: {
        chats: number,
        chatsNoMuted: number,
        chatsMentions: number,
        chatsMentionsNotMuted: number,
        messages: number,
        messagesNotMuted: number,
        messagesMentions: number,
        messagesMentionsNotMuted: number
    }) {
        this.userCounters.set(ctx, [uid, TYPE_NORMAL, COUNTER_ALL], counters.messages);
        this.userCounters.set(ctx, [uid, TYPE_NORMAL_NO_MUTED, COUNTER_ALL], counters.messagesNotMuted);
        this.userCounters.set(ctx, [uid, TYPE_DISTINCT, COUNTER_ALL], counters.chats);
        this.userCounters.set(ctx, [uid, TYPE_DISTINCT_NO_MUTED, COUNTER_ALL], counters.chatsNoMuted);
        this.userCounters.set(ctx, [uid, TYPE_NORMAL, COUNTER_MENTIONS], counters.messagesMentions);
        this.userCounters.set(ctx, [uid, TYPE_NORMAL_NO_MUTED, COUNTER_MENTIONS], counters.messagesMentionsNotMuted);
        this.userCounters.set(ctx, [uid, TYPE_DISTINCT, COUNTER_MENTIONS], counters.chatsMentions);
        this.userCounters.set(ctx, [uid, TYPE_DISTINCT_NO_MUTED, COUNTER_MENTIONS], counters.chatsMentionsNotMuted);
    }

    //
    // Update counters
    //

    private substractCounters(ctx: Context, uid: number, state: UserCounterState) {
        if (state.counter > 0) {
            this.userCounters.add(ctx, [uid, TYPE_DISTINCT, COUNTER_ALL], -1);
            this.userCounters.add(ctx, [uid, TYPE_NORMAL, COUNTER_ALL], -state.counter);
            if (!state.muted) {
                this.userCounters.add(ctx, [uid, TYPE_DISTINCT_NO_MUTED, COUNTER_ALL], -1);
                this.userCounters.add(ctx, [uid, TYPE_NORMAL_NO_MUTED, COUNTER_ALL], -state.counter);
            }
        }
        if (state.mentions > 0) {
            this.userCounters.add(ctx, [uid, TYPE_DISTINCT, COUNTER_MENTIONS], -1);
            this.userCounters.add(ctx, [uid, TYPE_NORMAL, COUNTER_MENTIONS], -state.mentions);
            if (!state.muted) {
                this.userCounters.add(ctx, [uid, TYPE_DISTINCT_NO_MUTED, COUNTER_MENTIONS], -1);
                this.userCounters.add(ctx, [uid, TYPE_NORMAL_NO_MUTED, COUNTER_MENTIONS], -state.mentions);
            }
        }
    }

    private addCounters(ctx: Context, uid: number, state: UserCounterState) {
        if (state.counter > 0) {
            this.userCounters.add(ctx, [uid, TYPE_DISTINCT, COUNTER_ALL], 1);
            this.userCounters.add(ctx, [uid, TYPE_NORMAL, COUNTER_ALL], state.counter);
            if (!state.muted) {
                this.userCounters.add(ctx, [uid, TYPE_DISTINCT_NO_MUTED, COUNTER_ALL], 1);
                this.userCounters.add(ctx, [uid, TYPE_NORMAL_NO_MUTED, COUNTER_ALL], state.counter);
            }
        }
        if (state.mentions > 0) {
            this.userCounters.add(ctx, [uid, TYPE_DISTINCT, COUNTER_MENTIONS], 1);
            this.userCounters.add(ctx, [uid, TYPE_NORMAL, COUNTER_MENTIONS], state.mentions);
            if (!state.muted) {
                this.userCounters.add(ctx, [uid, TYPE_DISTINCT_NO_MUTED, COUNTER_MENTIONS], 1);
                this.userCounters.add(ctx, [uid, TYPE_NORMAL_NO_MUTED, COUNTER_MENTIONS], state.mentions);
            }
        }
    }
}