import { injectable } from 'inversify';
import { Store } from '../../openland-module-db/FDB';
import { Context } from '@openland/context';
import { encoders, Subspace, TransactionCache, TupleItem } from '@openland/foundationdb';
import { CompactMessagesDirectory } from './CompactMessagesDirectory';
import { Metrics } from '../../openland-module-monitoring/Metrics';
import { AsyncLock } from '../../openland-utils/timer';

const PREFIX_COMACT_MESSAGES = 1;
const PREFIX_USER_READ_SEQS = 2;

const countersCache = new TransactionCache<{ cid: number, unreadCounter: number, haveMention: boolean }[]>('exp-chat-counters-cache');
const globalCounterCache = new TransactionCache<number>('exp-global-counter-cache');

function resetCache(ctx: Context) {
    countersCache.delete(ctx, 'counters');
    globalCounterCache.delete(ctx, 'counter');
}

const lockCache = new TransactionCache<AsyncLock>('exp-counters-fetch-lock');

function getLock(ctx: Context, key: string) {
    let cached = lockCache.get(ctx, key);
    if (cached) {
        return cached;
    }
    let lock = new AsyncLock();
    lockCache.set(ctx, key, lock);
    return lock;
}

@injectable()
export class ExperimentalCountersRepository {
    private directory = Store.ExperimentalCountersDirectory;
    readonly messages: CompactMessagesDirectory;
    readonly userReadSeqsSubspace: Subspace<TupleItem[], number>;

    private userMuteSettingsSubspace = Store.UserDialogMuteSettingDirectory
        .withKeyEncoding(encoders.tuple)
        .withValueEncoding(encoders.boolean);

    constructor() {
        this.messages = new CompactMessagesDirectory(
            this.directory.subspace(encoders.tuple.pack([PREFIX_COMACT_MESSAGES])),
            1000
        );

        this.userReadSeqsSubspace = this.directory
            .subspace(encoders.tuple.pack([PREFIX_USER_READ_SEQS]))
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.int32LE);
    }

    onMessageCreated = async (ctx: Context, uid: number, cid: number, seq: number, mentionedUsers: (number | 'all')[], hiddenForUsers: number[]) => {
        resetCache(ctx);
        // Reset sender counter
        this.onMessageRead(ctx, uid, cid, seq);

        await this.messages.add(ctx, cid, {
            uid,
            seq,
            mentions: mentionedUsers.map(m => m === 'all' ? 0 : m),
            hiddenFor: hiddenForUsers
        });
    }

    onMessageDeleted = async (ctx: Context, cid: number, seq: number) => {
        resetCache(ctx);
        await this.messages.remove(ctx, cid, seq);
    }

    onMessageEdited = async (ctx: Context, cid: number, uid: number, seq: number, mentionedUsers: (number | 'all')[], hiddenForUsers: number[]) => {
        resetCache(ctx);
        await this.messages.remove(ctx, cid, seq);
        await this.messages.add(ctx, cid, {
            uid,
            seq,
            mentions: mentionedUsers.map(m => m === 'all' ? 0 : m),
            hiddenFor: hiddenForUsers
        });
    }

    onAddDialog = async (ctx: Context, uid: number, cid: number) => {
        resetCache(ctx);
        let chatLastSeq = await Store.ConversationLastSeq.byId(cid).get(ctx);
        this.userReadSeqsSubspace.set(ctx, [uid, cid], chatLastSeq);
    }

    onRemoveDialog = (ctx: Context, uid: number, cid: number) => {
        resetCache(ctx);
        this.userReadSeqsSubspace.clear(ctx, [uid, cid]);
    }

    onMessageRead = (ctx: Context, uid: number, cid: number, toSeq: number) => {
        resetCache(ctx);
        this.userReadSeqsSubspace.set(ctx, [uid, cid], toSeq);
    }

    fetchUserCounters = async (ctx: Context, uid: number, includeAllMention = true) => {
        return await getLock(ctx, 'fetch-counters').inLock(async () => {
            let cached = countersCache.get(ctx, 'counters');
            if (cached) {
                return cached;
            }

            let start = Date.now();
            let userReadSeqs = await this.userReadSeqsSubspace.snapshotRange(ctx, [uid]);

            let counters = await Promise.all(userReadSeqs.map(async (readValue) => {
                let cid = readValue.key[readValue.key.length - 1] as number;
                let lastReadSeq = readValue.value || 0;

                return await this.fetchUserCounterForChat(ctx, uid, cid, lastReadSeq, includeAllMention);
            }));
            countersCache.set(ctx, 'counters', counters);
            Metrics.AllCountersResolveTime.report(Date.now() - start);
            return counters;
        });
    }

    fetchUserCountersForChats = async (ctx: Context, uid: number, cids: number[], includeAllMention = true) => {
        let userReadSeqs = await this.userReadSeqsSubspace.snapshotRange(ctx, [uid]);

        let counters = await Promise.all(cids.map(async (cid) => {
            let lastReadSeqValue = userReadSeqs.find(v => v.key[v.key.length - 1] === cid);
            let lastReadSeq = lastReadSeqValue ? lastReadSeqValue.value : 0;

            return await this.fetchUserCounterForChat(ctx, uid, cid, lastReadSeq, includeAllMention);
        }));

        return counters;
    }

    fetchUserGlobalCounter = async (ctx: Context, uid: number, countChats: boolean, excludeMuted: boolean) => {
        return await getLock(ctx, 'fetch-global-counter').inLock(async () => {
            let cached = globalCounterCache.get(ctx, 'counter');
            if (cached) {
                return cached;
            }

            let start = Date.now();
            let counters = await this.fetchUserCounters(ctx, uid);

            if (excludeMuted) {
                let mutedChats = await this.userMuteSettingsSubspace.range(ctx, [uid]);
                counters = counters.filter(c => !mutedChats.find(m => m.key[1] === c.cid));
            }

            let counter = 0;
            if (countChats) {
                counter = counters.filter(c => c.unreadCounter > 0).length;
            } else {
                counter = counters.reduce((acc, cur) => acc + cur.unreadCounter, 0);
            }

            globalCounterCache.set(ctx, 'counter', counter);
            Metrics.GlobalCounterResolveTime.report(Date.now() - start);
            return counter;
        });
    }

    private fetchUserCounterForChat = async (ctx: Context, uid: number, cid: number, lastReadSeq: number, includeAllMention = true) => {
        let messages = await this.messages.get(ctx, cid, lastReadSeq + 1);
        messages = messages.filter(m => m.uid !== uid && !m.hiddenFor.includes(uid));

        let unreadCounter = messages.length;
        let haveMention = messages.some(m => m.mentions.includes(0) || m.mentions.includes(uid));

        return {cid, unreadCounter, haveMention};
    }
}