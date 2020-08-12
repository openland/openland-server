import { injectable } from 'inversify';
import { encoders, Subspace, TupleItem } from '@openland/foundationdb';
import { Store } from '../../openland-module-db/FDB';
import { Context } from '@openland/context';
import { packUInt32Vector, unpackUInt32Vector } from '../../openland-utils/binary';
import { createLogger } from '@openland/log';

const PREFIX_USER_READ_SEQS = 1;
const PREFIX_COUNTERS = 2;

const PREFIX_DELETED_SEQS = 1;
const PREFIX_MENTIONS = 2;

const BUCKET_SIZE = 1000;

const ALL_MENTION = 0;

const INT32_BYTES = 32 / 8;
const MENTION_RECORD_MAGIC = 0xFFFFFFFF;

function packMentionsBucket(values: { seq: number, mentionedUsers: number[] }[]) {
    let mentionsCount = values.reduce((acc, cur) => acc + cur.mentionedUsers.length, 0);

    let buff = Buffer.alloc(INT32_BYTES + (mentionsCount * INT32_BYTES) + (values.length * INT32_BYTES * 3));

    let offset = 0;

    buff.writeUInt32LE(values.length, offset);
    offset += INT32_BYTES;

    for (let value of values) {
        buff.writeUInt32LE(MENTION_RECORD_MAGIC, offset);
        offset += INT32_BYTES;
        buff.writeUInt32LE(value.seq, offset);
        offset += INT32_BYTES;
        buff.writeUInt32LE(value.mentionedUsers.length, offset);
        offset += INT32_BYTES;
        for (let uid of value.mentionedUsers) {
            buff.writeUInt32LE(uid, offset);
            offset += INT32_BYTES;
        }
    }

    return buff;
}

function unpackMentionsBucket(buffer: Buffer) {
    let values = [];
    let offset = 0;

    let recordsCount = buffer.readUInt32LE(offset);
    offset += INT32_BYTES;

    for (let i = 0; i < recordsCount; i++) {
        let magic = buffer.readUInt32LE(offset);
        offset += INT32_BYTES;
        if (magic !== MENTION_RECORD_MAGIC) {
            throw new Error('Invalid magic');
        }
        let seq = buffer.readUInt32LE(offset);
        offset += INT32_BYTES;
        let uidsCount = buffer.readUInt32LE(offset);
        offset += INT32_BYTES;
        let uids = [];
        for (let j = 0; j < uidsCount; j++) {
            let uid = buffer.readUInt32LE(offset);
            offset += INT32_BYTES;
            uids.push(uid);
        }
        values.push({ seq, mentionedUsers: uids });
    }
    return values;
}

const log = createLogger('fast_counters');

@injectable()
export class FastCountersRepository {
    private directory = Store.FastCountersDirectory;
    private userReadSeqSubspace: Subspace<TupleItem[], number>;
    private countersSubspace: Subspace<TupleItem[], Buffer>;

    constructor() {
        this.userReadSeqSubspace = this.directory
            .subspace(encoders.tuple.pack([PREFIX_USER_READ_SEQS]))
            .withKeyEncoding(encoders.tuple)
            .withValueEncoding(encoders.int32LE);

        this.countersSubspace = this.directory
            .subspace(encoders.tuple.pack([PREFIX_COUNTERS]))
            .withKeyEncoding(encoders.tuple);
    }

    onMessageCreated = async (ctx: Context, cid: number, seq: number, mentionedUsers: (number|'all')[]) => {
        if (mentionedUsers.length === 0) {
            return;
        }
        let bucketNo = Math.ceil(seq / BUCKET_SIZE);
        let value = await this.countersSubspace.get(ctx, [cid, bucketNo, PREFIX_MENTIONS]);
        let records = value ? unpackMentionsBucket(value) : [];
        if (records.find(r => r.seq === seq)) {
            return;
        }
        records.push({ seq, mentionedUsers: mentionedUsers.map(v => v === 'all' ? ALL_MENTION : v ) });
        this.countersSubspace.set(ctx, [cid, bucketNo, PREFIX_MENTIONS], packMentionsBucket(records));
    }

    onMessageDeleted = async (ctx: Context, cid: number, seq: number) => {
        let bucketNo = Math.ceil(seq / BUCKET_SIZE);
        let [deletedSeqsBucket, mentionsBucket] = await Promise.all([
            this.countersSubspace.get(ctx, [cid, bucketNo, PREFIX_DELETED_SEQS]),
            this.countersSubspace.get(ctx, [cid, bucketNo, PREFIX_MENTIONS])
        ]);

        let deletedSeqs = deletedSeqsBucket ? unpackUInt32Vector(deletedSeqsBucket) : [];
        if (!deletedSeqs.includes(seq)) {
            deletedSeqs.push(seq);
            this.countersSubspace.set(ctx, [cid, bucketNo, PREFIX_DELETED_SEQS], packUInt32Vector(deletedSeqs));
        }
        let mentions = mentionsBucket ? unpackMentionsBucket(mentionsBucket) : [];
        if (mentions.find(record => record.seq === seq)) {
            mentions = mentions.filter(record => record.seq !== seq);
            this.countersSubspace.set(ctx, [cid, bucketNo, PREFIX_MENTIONS], packMentionsBucket(mentions));
        }
    }

    onMessageEdited = async (ctx: Context, cid: number, seq: number, mentionedUsers: (number|'all')[]) => {
        let bucketNo = Math.ceil(seq / BUCKET_SIZE);
        let value = await this.countersSubspace.get(ctx, [cid, bucketNo, PREFIX_MENTIONS]);
        let records = value ? unpackMentionsBucket(value) : [];
        let existing = records.find(r => r.seq === seq);

        if (existing) {
            if (mentionedUsers.length === 0) {
                records = records.filter(r => r.seq !== seq);
            } else {
                existing.mentionedUsers = mentionedUsers.map(v => v === 'all' ? ALL_MENTION : v );
            }
            this.countersSubspace.set(ctx, [cid, bucketNo, PREFIX_MENTIONS], packMentionsBucket(records));
        } else {
            if (mentionedUsers.length === 0) {
                return;
            } else {
                records.push({ seq, mentionedUsers: mentionedUsers.map(v => v === 'all' ? ALL_MENTION : v ) });
                this.countersSubspace.set(ctx, [cid, bucketNo, PREFIX_MENTIONS], packMentionsBucket(records));
            }
        }
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
            let bucketNo = Math.ceil(lastReadSeq / BUCKET_SIZE);

            if (lastReadSeq > chatLastSeq) {
                log.warn(ctx, `lastReadSeq > chatLastSeq, cid: ${cid}, uid: ${uid}`);
                this.onMessageRead(ctx, uid, cid, chatLastSeq);
                lastReadSeq = chatLastSeq;
            }

            if (chatLastSeq === lastReadSeq) {
                return { cid, unreadCounter: 0, haveMention: false };
            }

            let buckets = await this.countersSubspace.snapshotRange(ctx, [cid], { after: [cid, bucketNo - 1] });
            let deletedSeqs = buckets
                .filter(b => b.key[2] === PREFIX_DELETED_SEQS)
                .map(v => unpackUInt32Vector(v.value).filter(seq => seq > lastReadSeq))
                .flat();

            let unreadCounter = chatLastSeq - lastReadSeq - deletedSeqs.length;

            if (unreadCounter < 0) {
                unreadCounter = 0;
                log.warn(ctx, `negative unread counter, cid: ${cid}, uid: ${uid}`);
            }

            let mentions = buckets
                .filter(b => b.key[2] === PREFIX_MENTIONS)
                .map(v => unpackMentionsBucket(v.value).filter(r => r.seq > lastReadSeq))
                .flat();

            let haveMention = mentions.some(r => r.mentionedUsers.includes(uid) || r.mentionedUsers.includes(ALL_MENTION));

            return { cid, unreadCounter, haveMention };
        }));

        return counters;
    }
}