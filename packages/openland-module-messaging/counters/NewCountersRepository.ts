import { Context } from '@openland/context';
import { encoders, Subspace } from '@openland/foundationdb';
import { Message } from 'openland-module-db/store';
import { getAllMentions, hasAllMention } from 'openland-module-messaging/resolvers/ModernMessage.resolver';
import { CountersDirectory } from './CountersDirectory';
import { CounterSubscribersDirectory } from './CounterSubscribersDirectory';

const SUBSPACE_COUNTERS = 0;
const SUBSPACE_SUBSCRIBERS = 1;

export class NewCountersRepository {
    readonly subspace: Subspace;
    readonly counters: CountersDirectory;
    readonly subscribers: CounterSubscribersDirectory;

    constructor(subspace: Subspace) {
        this.subspace = subspace;
        this.counters = new CountersDirectory(
            subspace.subspace(encoders.tuple.pack([SUBSPACE_COUNTERS]))
        );
        this.subscribers = new CounterSubscribersDirectory(
            subspace.subspace(encoders.tuple.pack([SUBSPACE_SUBSCRIBERS]))
        );
    }

    onMessage = async (ctx: Context, message: Message) => {
        let deleted = !!message.deleted;
        let sender = message.uid;
        let allMention = hasAllMention(message);
        let mentions = getAllMentions(message);
        let visibleOnlyTo = message.visibleOnlyForUids ? message.visibleOnlyForUids : [];

        if (deleted) {
            await this.counters.removeMessage(ctx, [message.cid], message.seq);
        } else {
            await this.counters.addOrUpdateMessage(ctx, [message.cid], message.seq, {
                mentions,
                allMention,
                sender,
                visibleOnlyTo
            });
        }

        // Update direct subscribers
        let direct = await this.subscribers.getDirectSubscribers(ctx, message.cid);
        for (let d of direct) {
            let state = await this.subscribers.readState(ctx, { cid: message.cid, uid: d });
            if (!state || state.async) {
                continue;
            }
            let read = await this.counters.count(ctx, [message.cid], d, state.seq);
            await this.subscribers.updateDirect(ctx, { cid: message.cid, uid: d, counter: read.unread, mentions: read.unreadMentions });
        }
    }

    async subscribe(ctx: Context, args: { cid: number, uid: number, seq: number, muted: boolean }) {
        let read = await this.counters.count(ctx, [args.cid], args.uid, args.seq);
        await this.subscribers.subscribe(ctx, { uid: args.uid, cid: args.cid, muted: args.muted, seq: args.seq, counter: read.unread, mentions: read.unreadMentions });
    }

    async unsubscribe(ctx: Context, args: { cid: number, uid: number }) {
        await this.subscribers.unsubscribe(ctx, { uid: args.uid, cid: args.cid });
    }

    async readMessages(ctx: Context, args: { cid: number, uid: number, seq: number }) {
        let state = await this.subscribers.readState(ctx, { cid: args.cid, uid: args.uid });
        if (!state) {
            return;
        }
        let read = await this.counters.count(ctx, [args.cid], args.uid, args.seq);
        await this.subscribers.subscribe(ctx, { uid: args.uid, cid: args.cid, muted: state.muted, seq: args.seq, counter: read.unread, mentions: read.unreadMentions });
    }

    async updateMuted(ctx: Context, args: { cid: number, uid: number, muted: boolean }) {
        let state = await this.subscribers.readState(ctx, { cid: args.cid, uid: args.uid });
        if (!state) {
            return;
        }
        await this.subscribers.subscribe(ctx, { uid: args.uid, cid: args.cid, muted: args.muted, seq: state.seq, counter: state.counter, mentions: state.mentions });
    }

    async getGlobalCounter(ctx: Context, uid: number, excludeMuted: boolean, counter: 'all' | 'distinct' | 'all-mentions' | 'distinct-mentions') {
        let res = await this.subscribers.getCounter(ctx, uid, excludeMuted, counter);
        let asyncSubscriptions = await this.subscribers.getAsyncSubscriptions(ctx, uid);
        for (let subs of asyncSubscriptions) {
            if (subs.muted && excludeMuted) {
                continue;
            }
            let counters = await this.counters.count(ctx, [subs.cid], uid, subs.seq);
            if (counter === 'all') {
                res += counters.unread;
            } else if (counter === 'distinct') {
                if (counters.unread > 0) {
                    res++;
                }
            } else if (counter === 'all-mentions') {
                res += counters.unreadMentions;
            } else if (counter === 'distinct-mentions') {
                if (counters.unreadMentions > 0) {
                    res++;
                }
            }
        }
        return res;
    }

    async getLocalCounter(ctx: Context, uid: number, cid: number) {
        let readState = await this.subscribers.readState(ctx, { cid, uid });
        if (!readState) {
            return {
                unreadMentions: 0,
                unread: 0,
                debug: {
                    totalMessages: 0,
                    allMentions: 0,
                    totalSent: 0,
                    sentAllMentions: 0,
                    personalMentions: 0,
                    personalMessages: 0
                }
            };
        }
        return await this.counters.count(ctx, [cid], uid, readState.seq);
    }

    async getDebugCounter(ctx: Context, uid: number, cid: number) {
        let readState = await this.subscribers.readState(ctx, { cid, uid });
        if (!readState) {
            return null;
        }
        return await this.counters.count(ctx, [cid], uid, readState.seq);
    }

    async getChats(ctx: Context, uid: number) {
        return await this.subscribers.readAllStates(ctx, uid);
    }

    async getUnreadChats(ctx: Context, uid: number) {
        let states = await this.subscribers.readAllStates(ctx, uid);
        let allChats = states.map((v) => v.cid);
        return (await Promise.all(allChats.map(async (v) => ({ cid: v, counter: await this.getLocalCounter(ctx, uid, v) })))).filter((v) => v.counter.unread > 0).map((v) => v.cid);

        // let direct = states
        //     .filter((v) => !v.state.async && v.state.counter > 0)
        //     .map((v) => v.cid);
        // let async = (await Promise.all(states.filter((v) => v.state.async).map(async (v) => ({ cid: v.cid, counter: await this.getLocalCounter(ctx, uid, v.cid) })))).filter((v) => v.counter.unread > 0).map((v) => v.cid);
        // return [...direct, ...async];
    }
}