import { injectable } from 'inversify';
import { encoders, TransactionCache } from '@openland/foundationdb';
import { Store } from '../../openland-module-db/FDB';
import { Context } from '@openland/context';
import { createLogger } from '@openland/log';
import { BucketCountingDirectory } from '../utils/BucketCountingDirectory';
import { Metrics } from '../../openland-module-monitoring/Metrics';
import { lazyInject } from '../../openland-modules/Modules.container';
import { UserReadSeqsDirectory } from './UserReadSeqsDirectory';

const PREFIX_DELETED_SEQS = 0;
const PREFIX_USER_MENTIONS = 1;
const PREFIX_ALL_MENTIONS = 2;
// const PREFIX_USER_READ_SEQS = 3;
const PREFIX_HIDDEN_MESSAGES = 4;

const BUCKET_SIZE = 1000;

const log = createLogger('fast_counters');

const countersCache = new TransactionCache<{ cid: number, unreadCounter: number, haveMention: boolean }[]>('chat-counters-cache');
const globalCounterCache = new TransactionCache<number>('global-counter-cache');

@injectable()
export class FastCountersRepository {
    private directory = Store.FastCountersDirectory;

    readonly deletedSeqs: BucketCountingDirectory;
    readonly userMentions: BucketCountingDirectory;
    readonly allMentions: BucketCountingDirectory;
    readonly hiddenMessages: BucketCountingDirectory;
    // readonly userReadSeqsSubspace: Subspace<TupleItem[], number>;

    @lazyInject('UserReadSeqsDirectory')
    readonly userReadSeqs!: UserReadSeqsDirectory;

    private userMuteSettingsSubspace = Store.UserDialogMuteSettingDirectory
        .withKeyEncoding(encoders.tuple)
        .withValueEncoding(encoders.boolean);

    constructor() {
        this.deletedSeqs = new BucketCountingDirectory(
            this.directory.subspace(encoders.tuple.pack([PREFIX_DELETED_SEQS])),
            BUCKET_SIZE
        );

        this.userMentions = new BucketCountingDirectory(
            this.directory.subspace(encoders.tuple.pack([PREFIX_USER_MENTIONS])),
            BUCKET_SIZE
        );

        this.allMentions = new BucketCountingDirectory(
            this.directory.subspace(encoders.tuple.pack([PREFIX_ALL_MENTIONS])),
            BUCKET_SIZE
        );

        this.hiddenMessages = new BucketCountingDirectory(
            this.directory.subspace(encoders.tuple.pack([PREFIX_HIDDEN_MESSAGES])),
            BUCKET_SIZE
        );

        // this.userReadSeqsSubspace = this.directory
        //     .subspace(encoders.tuple.pack([PREFIX_USER_READ_SEQS]))
        //     .withKeyEncoding(encoders.tuple)
        //     .withValueEncoding(encoders.int32LE);
    }

    onMessageCreated = async (ctx: Context, uid: number, cid: number, seq: number, mentionedUsers: (number | 'all')[], hiddenForUsers: number[]) => {
        countersCache.delete(ctx, 'counters');
        globalCounterCache.delete(ctx, 'counter');
        // Reset sender counter
        this.onMessageRead(ctx, uid, cid, seq);

        if (mentionedUsers.length > 0) {
            await Promise.all(mentionedUsers.map(m => {
                if (m === 'all') {
                    return this.allMentions.add(ctx, [cid], seq);
                } else {
                    return this.userMentions.add(ctx, [m, cid], seq);
                }
            }));
        }
        if (hiddenForUsers.length > 0) {
            await Promise.all(hiddenForUsers.map(u => this.hiddenMessages.add(ctx, [u, cid], seq)));
        }
    }

    onMessageDeleted = async (ctx: Context, cid: number, seq: number, mentionedUsers: (number | 'all')[], hiddenForUsers: number[]) => {
        countersCache.delete(ctx, 'counters');
        globalCounterCache.delete(ctx, 'counter');
        await this.deletedSeqs.add(ctx, [cid], seq);
        if (mentionedUsers.length > 0) {
            await Promise.all(mentionedUsers.map(m => {
                if (m === 'all') {
                    return this.allMentions.remove(ctx, [cid], seq);
                } else {
                    return this.userMentions.remove(ctx, [m, cid], seq);
                }
            }));
        }
        if (hiddenForUsers.length > 0) {
            await Promise.all(hiddenForUsers.map(u => this.hiddenMessages.remove(ctx, [u, cid], seq)));
        }
    }

    onMessageEdited = async (ctx: Context, cid: number, seq: number, oldMentions: (number | 'all')[], newMentions: (number | 'all')[]) => {
        countersCache.delete(ctx, 'counters');
        globalCounterCache.delete(ctx, 'counter');
        let removed = oldMentions.filter(x => !newMentions.includes(x));
        let added = newMentions.filter(x => !oldMentions.includes(x));

        await Promise.all(removed.map(m => {
            if (m === 'all') {
                return this.allMentions.remove(ctx, [cid], seq);
            } else {
                return this.userMentions.remove(ctx, [m, cid], seq);
            }
        }));
        await Promise.all(added.map(m => {
            if (m === 'all') {
                return this.allMentions.add(ctx, [cid], seq);
            } else {
                return this.userMentions.add(ctx, [m, cid], seq);
            }
        }));
    }

    onMessageRead = (ctx: Context, uid: number, cid: number, toSeq: number) => {
        countersCache.delete(ctx, 'counters');
        globalCounterCache.delete(ctx, 'counter');
        // this.userReadSeqsSubspace.set(ctx, [uid, cid], toSeq);
    }

    onAddDialog = async (ctx: Context, uid: number, cid: number) => {
        countersCache.delete(ctx, 'counters');
        globalCounterCache.delete(ctx, 'counter');
        // let chatLastSeq = await Store.ConversationLastSeq.byId(cid).get(ctx);
        // this.userReadSeqsSubspace.set(ctx, [uid, cid], chatLastSeq);
    }

    onRemoveDialog = (ctx: Context, uid: number, cid: number) => {
        countersCache.delete(ctx, 'counters');
        globalCounterCache.delete(ctx, 'counter');
        // this.userReadSeqsSubspace.clear(ctx, [uid, cid]);
    }

    fetchUserCounters = async (ctx: Context, uid: number, includeAllMention = true) => {
        let cached = countersCache.get(ctx, 'counters');
        if (cached) {
            return cached;
        }

        let start = Date.now();
        let userReadSeqs = await this.userReadSeqs.getUserReadSeqs(ctx, uid);

        let counters = await Promise.all(userReadSeqs.map(async (readValue) => {
            return await this.fetchUserCounterForChat(ctx, uid, readValue.cid, readValue.seq, includeAllMention);
        }));
        countersCache.set(ctx, 'counters', counters);
        Metrics.AllCountersResolveTime.report(Date.now() - start);
        return counters;
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
    }

    private fetchUserCounterForChat = async (ctx: Context, uid: number, cid: number, lastReadSeq: number, includeAllMention = true) => {
        let chatLastSeq = await Store.ConversationLastSeq.byId(cid).get(ctx);

        if (lastReadSeq > chatLastSeq) {
            log.warn(ctx, `lastReadSeq > chatLastSeq, cid: ${cid}, uid: ${uid}`);
            this.onMessageRead(ctx, uid, cid, chatLastSeq);
            lastReadSeq = chatLastSeq;
        }

        if (chatLastSeq === lastReadSeq) {
            return {cid, unreadCounter: 0, haveMention: false};
        }

        let [deletedSeqsCount, hiddenMessagesCount] = await Promise.all([
            this.deletedSeqs.count(ctx, [cid], {from: lastReadSeq + 1}),
            this.hiddenMessages.count(ctx, [uid, cid], {from: lastReadSeq + 1})
        ]);

        let unreadCounter = chatLastSeq - lastReadSeq - deletedSeqsCount - hiddenMessagesCount;

        if (unreadCounter < 0) {
            unreadCounter = 0;
            log.warn(ctx, `negative unread counter, cid: ${cid}, uid: ${uid}`);
        }

        if (unreadCounter === 0) {
            return {cid, unreadCounter: 0, haveMention: false};
        }

        let [mentionsCount, allMentionsCount] = await Promise.all([
            this.userMentions.count(ctx, [uid, cid], {from: lastReadSeq + 1}),
            this.allMentions.count(ctx, [cid], {from: lastReadSeq + 1})
        ]);

        let haveMention = mentionsCount > 0 || (includeAllMention && allMentionsCount > 0);

        return {cid, unreadCounter, haveMention};
    }
}