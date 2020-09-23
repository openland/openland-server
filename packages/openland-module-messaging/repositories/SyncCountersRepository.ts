import { encoders, inTx, Subspace, TupleItem } from '@openland/foundationdb';
import { injectable } from 'inversify';
import { Context } from '@openland/context';
import { hasMention } from '../resolvers/ModernMessage.resolver';
import { Store } from 'openland-module-db/FDB';
import { Message } from 'openland-module-db/store';
import { lazyInject } from '../../openland-modules/Modules.container';
import { UserReadSeqsDirectory } from './UserReadSeqsDirectory';
import { CompacterMessagesDirectory } from './CompacterMessagesDirectory';

const PREFIX_COUNTERS = 0;
const PREFIX_MENTIONS = 1;

const PREFIX_COMACT_MESSAGES = 1;
const ALL_MENTION_UID = 0;

@injectable()
export class SyncCountersRepository {
    private directory = Store.SyncCountersDirectory;

    @lazyInject('UserReadSeqsDirectory')
    readonly userReadSeqs!: UserReadSeqsDirectory;

    private readonly countersSubspace: Subspace<TupleItem[], number>;
    private readonly mentionsSubspace: Subspace<TupleItem[], boolean>;

    readonly messages: CompacterMessagesDirectory;

    constructor() {
        this.countersSubspace = this.directory
            .subspace(encoders.tuple.pack([PREFIX_COUNTERS]))
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.int32LE);

        this.mentionsSubspace = this.directory
            .subspace(encoders.tuple.pack([PREFIX_MENTIONS]))
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.boolean);

        this.messages = new CompacterMessagesDirectory(
            Store.NewCountersDirectory.subspace(encoders.tuple.pack([PREFIX_COMACT_MESSAGES])),
            1000
        );
    }

    onMessageCreated = async (parent: Context, uid: number, message: Message) => {
        return await inTx(parent, async (ctx) => {
            // Ignore already deleted messages
            if (message.deleted) {
                return { delta: 0 };
            }

            // Ignore own messages
            if (message.uid === uid) {
                return { delta: 0 };
            }

            // Ignore hidden messages
            if (message.hiddenForUids?.includes(uid)) {
                return;
            }

            let cid = message.cid;

            // Updating counters if not read already
            let readMessageSeq = await this.userReadSeqs.getUserReadSeqForChat(ctx, uid, message.cid);

            if (message.seq! > readMessageSeq) {
                // Mark dialog as having mention
                if (!message.isService && hasMention(message, uid)) {
                    this.mentionsSubspace.set(ctx, [uid, cid], true);
                }
                // Update Counters
                this.countersSubspace.add(ctx, [uid, cid], 1);
                return;
            }

            return;
        });
    }

    onMessageDeleted = async (parent: Context, uid: number, message: Message) => {
        return await inTx(parent, async (ctx) => {
            let cid = message.cid;

            // Updating counters if not read already
            let readMessageSeq = await this.userReadSeqs.getUserReadSeqForChat(ctx, uid, message.cid);

            if (message.uid !== uid && (message.seq! > readMessageSeq)) {
                this.countersSubspace.add(ctx, [uid, cid], -1);
                // Reset mention flag if needed
                if (await this.mentionsSubspace.get(ctx, [uid, cid])) {
                    let messages = await this.messages.get(ctx, cid, readMessageSeq + 1);
                    let haveMention = messages.some(m => m.uid !== uid && (m.mentions.includes(ALL_MENTION_UID) || m.mentions.includes(uid)));
                    this.mentionsSubspace.set(ctx, [uid, cid], haveMention);
                }
                return;
            }
        });
    }

    onMessageRead = async (parent: Context, uid: number, prevReadMessageSeq: number, message: Message) => {
        return await inTx(parent, async (ctx) => {
            let cid = message.cid;

            if (prevReadMessageSeq < message.seq!) {
                // Find all remaining messages
                let messages = await this.messages.get(ctx, cid, prevReadMessageSeq + 1);
                let remainingCount = messages.filter(m => !m.hiddenFor.includes(uid)).length;

                this.countersSubspace.set(ctx, [uid, cid], remainingCount);
                let haveMention = messages.some(m => m.uid !== uid && (m.mentions.includes(ALL_MENTION_UID) || m.mentions.includes(uid)));
                this.mentionsSubspace.set(ctx, [uid, cid], haveMention);
                return;
            }
        });
    }

    onMessageEdit = async (parent: Context, uid: number, message: Message) => {
        return await inTx(parent, async (ctx) => {
            let cid = message.cid;

            // Updating counters if not read already
            let readMessageSeq = await this.userReadSeqs.getUserReadSeqForChat(ctx, uid, message.cid);
            if (readMessageSeq >= message.seq!) {
                return;
            }

            // Reset mention flag if needed
            if (await this.mentionsSubspace.get(ctx, [uid, cid])) {
                let messages = await this.messages.get(ctx, cid, readMessageSeq + 1);
                let haveMention = messages.some(m => m.uid !== uid && (m.mentions.includes(ALL_MENTION_UID) || m.mentions.includes(uid)));
                this.mentionsSubspace.set(ctx, [uid, cid], haveMention);
            }
            return;
        });
    }

    onDialogDeleted = async (parent: Context, uid: number, cid: number) => {
        return await inTx(parent, async (ctx) => {
            this.countersSubspace.clear(ctx, [uid, cid]);
            this.mentionsSubspace.clear(ctx, [uid, cid]);
        });
    }

    fetchUserCounters = async (parent: Context, uid: number) => {
        let [counters, mentions] = await Promise.all([
            this.countersSubspace.range(parent, [uid]),
            this.mentionsSubspace.range(parent, [uid])
        ]);
        let res: { cid: number, unreadCounter: number, haveMention: boolean }[] = [];

        for (let counter of counters) {
            let cid = counter.key[1] as number;
            let unread = counter.value || 0;
            let mention = mentions.find(m => m.key[1] === cid);
            let haveMention = mention ? mention.value : false;
            res.push({
                cid,
                unreadCounter: unread,
                haveMention: haveMention
            });
        }
        return res;
    }

    setCounterForChat = async (parent: Context, uid: number, cid: number, unread: number, haveMention: boolean) => {
        return await inTx(parent, async (ctx) => {
            this.countersSubspace.set(ctx, [uid, cid], unread);
            this.mentionsSubspace.set(ctx, [uid, cid], haveMention);
        });
    }
}