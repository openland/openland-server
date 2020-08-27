import { injectable } from 'inversify';
import { encoders, Subspace, TupleItem } from '@openland/foundationdb';
import { Store } from '../../openland-module-db/FDB';
import { Context } from '@openland/context';
import { createLogger } from '@openland/log';
import { BucketCountingDirectory } from '../utils/BucketCountingDirectory';

const PREFIX_DELETED_SEQS = 0;
const PREFIX_USER_MENTIONS = 1;
const PREFIX_ALL_MENTIONS = 2;
const PREFIX_USER_READ_SEQS = 3;
const PREFIX_HIDDEN_MESSAGES = 4;

const BUCKET_SIZE = 1000;

const log = createLogger('fast_counters');

@injectable()
export class FastCountersRepository {
    private directory = Store.FastCountersDirectory;

    private deletedSeqs: BucketCountingDirectory;
    private userMentions: BucketCountingDirectory;
    private allMentions: BucketCountingDirectory;
    private hiddenMessages: BucketCountingDirectory;
    private userReadSeqsSubspace: Subspace<TupleItem[], number>;

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

        this.userReadSeqsSubspace = this.directory
            .subspace(encoders.tuple.pack([PREFIX_USER_READ_SEQS]))
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.int32LE);
    }

    onMessageCreated = async (ctx: Context, uid: number, cid: number, seq: number, mentionedUsers: (number|'all')[], hiddenForUsers: number[]) => {
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

    onMessageDeleted = async (ctx: Context, cid: number, seq: number, mentionedUsers: (number|'all')[]) => {
        await this.deletedSeqs.add(ctx, [cid], seq);
        if (mentionedUsers.length === 0) {
            return;
        }
        await Promise.all(mentionedUsers.map(m => {
            if (m === 'all') {
                return this.allMentions.remove(ctx, [cid], seq);
            } else {
                return this.userMentions.remove(ctx, [m, cid], seq);
            }
        }));
    }

    onMessageEdited = async (ctx: Context, cid: number, seq: number, oldMentions: (number|'all')[], newMentions: (number|'all')[]) => {
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
        this.userReadSeqsSubspace.set(ctx, [uid, cid], toSeq);
    }

    onAddDialog = async (ctx: Context, uid: number, cid: number) => {
        let chatLastSeq = await Store.ConversationLastSeq.byId(cid).get(ctx);
        this.userReadSeqsSubspace.set(ctx, [uid, cid], chatLastSeq);
    }

    onRemoveDialog = (ctx: Context, uid: number, cid: number) => {
        this.userReadSeqsSubspace.clear(ctx, [uid, cid]);
    }

    fetchUserCounters = async (ctx: Context, uid: number, includeAllMention = true) => {
        let userReadSeqs = await this.userReadSeqsSubspace.snapshotRange(ctx, [uid]);

        let counters = await Promise.all(userReadSeqs.map(async (readValue) => {
            let cid = readValue.key[readValue.key.length - 1] as number;
            let lastReadSeq = readValue.value || 0;

            return await this.fetchUserCounterForChat(ctx, uid, cid, lastReadSeq, includeAllMention);
        }));

        return counters;
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

    private fetchUserCounterForChat = async (ctx: Context, uid: number, cid: number, lastReadSeq: number, includeAllMention = true) => {
        let chatLastSeq = await Store.ConversationLastSeq.byId(cid).get(ctx);

        if (lastReadSeq > chatLastSeq) {
            log.warn(ctx, `lastReadSeq > chatLastSeq, cid: ${cid}, uid: ${uid}`);
            this.onMessageRead(ctx, uid, cid, chatLastSeq);
            lastReadSeq = chatLastSeq;
        }

        if (chatLastSeq === lastReadSeq) {
            return { cid, unreadCounter: 0, haveMention: false };
        }

        let [deletedSeqsCount, hiddenMessagesCount] = await Promise.all([
            this.deletedSeqs.count(ctx, [cid], { from: lastReadSeq }),
            this.hiddenMessages.count(ctx, [uid, cid], { from: lastReadSeq })
        ]);

        let unreadCounter = chatLastSeq - lastReadSeq - deletedSeqsCount - hiddenMessagesCount;

        if (unreadCounter < 0) {
            unreadCounter = 0;
            log.warn(ctx, `negative unread counter, cid: ${cid}, uid: ${uid}`);
        }

        if (unreadCounter === 0) {
            return { cid, unreadCounter: 0, haveMention: false };
        }

        let [mentionsCount, allMentionsCount] = await Promise.all([
            this.userMentions.count(ctx, [uid, cid], { from: lastReadSeq }),
            this.allMentions.count(ctx, [cid], { from: lastReadSeq })
        ]);

        let haveMention = mentionsCount > 0 || (includeAllMention && allMentionsCount > 0);

        return { cid, unreadCounter, haveMention };
    }
}