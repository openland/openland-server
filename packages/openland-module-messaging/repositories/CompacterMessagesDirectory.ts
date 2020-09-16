import { encoders, inTx, Subspace, TupleItem } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { BufferReader, BufferWriter } from '../../openland-utils/buffer';

type CompactMessage = {
    seq: number,
    uid: number,
    mentions: number[],
    hiddenFor: number[],
    deleted: boolean
};

const DELETED_MESSAGE_MAGIC = 0xFFFFFFFF;
const MESSAGE_MAGIC = 0xDEADBEEF;

function packBucket(messages: CompactMessage[]) {
    let buff = new BufferWriter();
    buff.writeUInt32LE(messages.length);

    for (let msg of messages) {
        if (msg.deleted) {
            buff.writeUInt32LE(DELETED_MESSAGE_MAGIC);
            buff.writeUInt32LE(msg.seq);
        } else {
            buff.writeUInt32LE(MESSAGE_MAGIC);
            buff.writeUInt32LE(msg.seq);
            buff.writeUInt32LE(msg.uid);
            buff.writeUInt32LEVector(msg.mentions);
            buff.writeUInt32LEVector(msg.hiddenFor);
        }
    }

    return buff.build();
}

function unpackBucket(data: Buffer) {
    let buff = new BufferReader(data);
    let count = buff.readUInt32LE();
    let res: CompactMessage[] = [];
    for (let i = 0; i < count; i++) {
        let type = buff.readUInt32LE();
        if (type === MESSAGE_MAGIC) {
            res.push({
                seq: buff.readUInt32LE(),
                uid: buff.readUInt32LE(),
                mentions: buff.readUInt32Vector(),
                hiddenFor: buff.readUInt32Vector(),
                deleted: false
            });
        } else if (type === DELETED_MESSAGE_MAGIC) {
            res.push({
                seq: buff.readUInt32LE(),
                uid: -1,
                mentions: [],
                hiddenFor: [],
                deleted: true
            });
        }
    }
    return res;
}

export class CompacterMessagesDirectory {
    private bucketSize: number;
    private directory: Subspace<TupleItem[], Buffer>;

    constructor(directory: Subspace<Buffer, Buffer>, bucketSize: number) {
        this.directory = directory
            .withKeyEncoding(encoders.tuple);

        this.bucketSize = bucketSize;
    }

    /**
     * Stores only messages with mentions | hidden for some users
     */
    onNewMessage = async (parent: Context, cid: number, message: CompactMessage) => {
        return await inTx(parent, async (ctx) => {
            if (message.hiddenFor.length === 0 && message.mentions.length === 0) {
                return;
            }

            let bucketNo = Math.ceil(message.seq / this.bucketSize);
            let bucket = await this.directory.get(ctx, [cid, bucketNo]);
            let messages = bucket ? unpackBucket(bucket) : [];

            messages = messages.filter(m => m.seq !== message.seq);
            messages.push(message);
            this.directory.set(ctx, [cid, bucketNo], packBucket(messages));
        });
    }

    onMessageDelete = async (parent: Context, cid: number, seq: number) => {
        return await inTx(parent, async (ctx) => {
            let bucketNo = Math.ceil(seq / this.bucketSize);
            let bucket = await this.directory.get(ctx, [cid, bucketNo]);
            let messages = bucket ? unpackBucket(bucket) : [];

            messages = messages.filter(m => m.seq !== seq);
            messages.push({ seq, deleted: true, hiddenFor: [], mentions: [], uid: -1 });
            this.directory.set(ctx, [cid, bucketNo], packBucket(messages));
        });
    }

    onMessageUpdate = async (parent: Context, cid: number, message: CompactMessage) => {
        return await inTx(parent, async (ctx) => {
            let bucketNo = Math.ceil(message.seq / this.bucketSize);
            let bucket = await this.directory.get(ctx, [cid, bucketNo]);
            let messages = bucket ? unpackBucket(bucket) : [];

            messages = messages.filter(m => m.seq !== message.seq);
            if (message.mentions.length > 0 || message.hiddenFor.length > 0) {
                messages.push(message);
            }
            this.directory.set(ctx, [cid, bucketNo], packBucket(messages));
        });
    }

    get = async (parent: Context, cid: number, from: number) => {
        let bucketNo = Math.ceil(from / this.bucketSize);
        let batches = await this.directory.range(parent, [cid], { after: [cid, bucketNo - 1] });
        let all = batches.map(v => unpackBucket(v.value)).flat();

        return all.filter(msg => msg.seq >= from);
    }
}