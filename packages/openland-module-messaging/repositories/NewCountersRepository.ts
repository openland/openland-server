import { injectable } from 'inversify';
import { Store } from '../../openland-module-db/FDB';
import { Context } from '@openland/context';
import { encoders, TransactionCache } from '@openland/foundationdb';
import { Metrics } from '../../openland-module-monitoring/Metrics';
import { AsyncLock } from '../../openland-utils/timer';
import { CompacterMessagesDirectory } from './CompacterMessagesDirectory';
import { lazyInject } from '../../openland-modules/Modules.container';
import { UserReadSeqsDirectory } from './UserReadSeqsDirectory';

const PREFIX_COMACT_MESSAGES = 1;

const ALL_MENTION_UID = 0;

const countersCache = new TransactionCache<{ cid: number, unreadCounter: number, haveMention: boolean }[]>('new-chat-counters-cache');
const globalCounterCache = new TransactionCache<number>('new-global-counter-cache');

function resetCache(ctx: Context) {
    countersCache.delete(ctx, 'counters');
    globalCounterCache.delete(ctx, 'counter');
}

const lockCache = new TransactionCache<AsyncLock>('new-counters-fetch-lock');

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
export class NewCountersRepository {
    private directory = Store.NewCountersDirectory;
    readonly messages: CompacterMessagesDirectory;

    @lazyInject('UserReadSeqsDirectory')
    readonly userReadSeqs!: UserReadSeqsDirectory;

    private userMuteSettingsSubspace = Store.UserDialogMuteSettingDirectory
        .withKeyEncoding(encoders.tuple)
        .withValueEncoding(encoders.boolean);

    constructor() {
        this.messages = new CompacterMessagesDirectory(
            this.directory.subspace(encoders.tuple.pack([PREFIX_COMACT_MESSAGES])),
            1000
        );
    }

    onMessageCreated = async (ctx: Context, uid: number, cid: number, seq: number, mentionedUsers: (number | 'all')[], hiddenForUsers: number[]) => {
        resetCache(ctx);
        await this.messages.onNewMessage(ctx, cid, {
            uid,
            seq,
            mentions: mentionedUsers.map(m => m === 'all' ? ALL_MENTION_UID : m),
            hiddenFor: hiddenForUsers,
            deleted: false
        });
    }

    onMessageDeleted = async (ctx: Context, cid: number, seq: number) => {
        resetCache(ctx);
        await this.messages.onMessageDelete(ctx, cid, seq);
    }

    onMessageEdited = async (ctx: Context, cid: number, uid: number, seq: number, mentionedUsers: (number | 'all')[], hiddenForUsers: number[]) => {
        resetCache(ctx);
        await this.messages.onMessageUpdate(ctx, cid, {
            uid,
            seq,
            mentions: mentionedUsers.map(m => m === 'all' ? ALL_MENTION_UID : m),
            hiddenFor: hiddenForUsers,
            deleted: false
        });
    }

    fetchUserCounters = async (ctx: Context, uid: number, includeAllMention = true) => {
        return await getLock(ctx, 'fetch-counters').inLock(async () => {
            let cached = countersCache.get(ctx, 'counters');
            if (cached) {
                return cached;
            }

            let start = Date.now();
            let userReadSeqs = await this.userReadSeqs.getUserReadSeqs(ctx, uid);

            let counters = await Promise.all(userReadSeqs.map(async (readSeq) => {
                return await this.fetchUserCounterForChat(ctx, uid, readSeq.cid, readSeq.seq, includeAllMention);
            }));
            countersCache.set(ctx, 'counters', counters);
            Metrics.AllCountersResolveTime.report(Date.now() - start);
            Metrics.AllCountersResolveChatsCount.report(userReadSeqs.length);
            return counters;
        });
    }

    fetchUserCountersForChats = async (ctx: Context, uid: number, cids: number[], includeAllMention = true) => {
        let userReadSeqs = await this.userReadSeqs.getUserReadSeqs(ctx, uid);
        let counters = await Promise.all(cids.map(async (cid) => {
            let lastReadSeqValue = userReadSeqs.find(v => v.cid === cid);
            let lastReadSeq = lastReadSeqValue ? lastReadSeqValue.seq : 0;

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
        let chatLastSeq = await Store.ConversationLastSeq.get(ctx, cid);
        let messages = await this.messages.get(ctx, cid, lastReadSeq + 1);
        let deletedSeqsCount = messages.filter(m => m.deleted).length;
        let hiddenMessagesCount = messages.filter(m => m.hiddenFor.includes(uid)).length;

        let unreadCounter = chatLastSeq - lastReadSeq - deletedSeqsCount - hiddenMessagesCount;
        let haveMention = messages.some(m => m.uid !== uid && (m.mentions.includes(ALL_MENTION_UID) || m.mentions.includes(uid)));

        return {cid, unreadCounter, haveMention};
    }
}