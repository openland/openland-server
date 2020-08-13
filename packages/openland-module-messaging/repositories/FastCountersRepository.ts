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

const BUCKET_SIZE = 1000;

const log = createLogger('fast_counters');

@injectable()
export class FastCountersRepository {
    private directory = Store.FastCountersDirectory;

    private deletedSeqs: BucketCountingDirectory;
    private userMentions: BucketCountingDirectory;
    private allMentions: BucketCountingDirectory;
    private userReadSeqSubspace: Subspace<TupleItem[], number>;

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

        this.userReadSeqSubspace = this.directory
            .subspace(encoders.tuple.pack([PREFIX_USER_READ_SEQS]))
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.int32LE);
    }

    onMessageCreated = async (ctx: Context, uid: number, cid: number, seq: number, mentionedUsers: (number|'all')[]) => {
        // Reset sender counter
        this.onMessageRead(ctx, uid, cid, seq);

        if (mentionedUsers.length === 0) {
            return;
        }
        await Promise.all(mentionedUsers.map(async m => {
            if (m === 'all') {
                await this.allMentions.add(ctx, [cid], seq);
            } else {
                await this.userMentions.add(ctx, [m, cid], seq);
            }
        }));
    }

    onMessageDeleted = async (ctx: Context, cid: number, seq: number, mentionedUsers: (number|'all')[]) => {
        await this.deletedSeqs.add(ctx, [cid], seq);
        await Promise.all(mentionedUsers.map(async m => {
            if (m === 'all') {
                await this.allMentions.remove(ctx, [cid], seq);
            } else {
                await this.userMentions.remove(ctx, [m, cid], seq);
            }
        }));
    }

    onMessageEdited = async (ctx: Context, cid: number, seq: number, oldMentions: (number|'all')[], newMentions: (number|'all')[]) => {
        await Promise.all(oldMentions.map(async m => {
            if (m === 'all') {
                await this.allMentions.remove(ctx, [cid], seq);
            } else {
                await this.userMentions.remove(ctx, [m, cid], seq);
            }
        }));
        await Promise.all(newMentions.map(async m => {
            if (m === 'all') {
                await this.allMentions.add(ctx, [cid], seq);
            } else {
                await this.userMentions.add(ctx, [m, cid], seq);
            }
        }));
    }

    onMessageRead = (ctx: Context, uid: number, cid: number, toSeq: number) => {
        this.userReadSeqSubspace.set(ctx, [uid, cid], toSeq);
    }

    onAddDialog = async (ctx: Context, uid: number, cid: number) => {
        let chatLastSeq = await Store.ConversationLastSeq.byId(cid).get(ctx);
        this.userReadSeqSubspace.set(ctx, [uid, cid], chatLastSeq);
    }

    onRemoveDialog = (ctx: Context, uid: number, cid: number) => {
        this.userReadSeqSubspace.clear(ctx, [uid, cid]);
    }

    fetchUserCounters = async (ctx: Context, uid: number) => {
        let userReadSeqs = await this.userReadSeqSubspace.snapshotRange(ctx, [uid]);

        let counters = await Promise.all(userReadSeqs.map(async (readValue) => {
            let cid = readValue.key[readValue.key.length - 1] as number;
            let chatLastSeq = await Store.ConversationLastSeq.byId(cid).get(ctx);
            let lastReadSeq = readValue.value || 0;

            if (lastReadSeq > chatLastSeq) {
                log.warn(ctx, `lastReadSeq > chatLastSeq, cid: ${cid}, uid: ${uid}`);
                this.onMessageRead(ctx, uid, cid, chatLastSeq);
                lastReadSeq = chatLastSeq;
            }

            if (chatLastSeq === lastReadSeq) {
                return { cid, unreadCounter: 0, haveMention: false };
            }

            let deletedSeqsCount = await this.deletedSeqs.count(ctx, [cid], { from: lastReadSeq });

            let unreadCounter = chatLastSeq - lastReadSeq - deletedSeqsCount;

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

            let haveMention = mentionsCount > 0 || allMentionsCount > 0;

            return { cid, unreadCounter, haveMention };
        }));

        return counters;
    }
}