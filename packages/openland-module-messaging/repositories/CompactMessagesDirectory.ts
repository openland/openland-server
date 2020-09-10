import { encoders, getTransaction, inTx, Subspace, TupleItem } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { BufferReader, BufferWriter } from '../../openland-utils/buffer';

const MESSAGE_MAGIC = 0xFFFFFFFF;

type CompactMessage = { seq: number, uid: number, mentions: number[], hiddenFor: number[] };

function packBucket(messages: CompactMessage[]) {
    let buff = new BufferWriter();
    buff.writeUInt32LE(messages.length);

    for (let msg of messages) {
        buff.writeUInt32LE(MESSAGE_MAGIC);
        buff.writeUInt32LE(msg.seq);
        buff.writeUInt32LE(msg.uid);
        buff.writeUInt32LEVector(msg.mentions);
        buff.writeUInt32LEVector(msg.hiddenFor);
    }

    return buff.build();
}

function unpackBucket(data: Buffer) {
    let buff = new BufferReader(data);
    let count = buff.readUInt32LE();
    let res: CompactMessage[] = [];
    for (let i = 0; i < count; i++) {
        if (buff.readUInt32LE() !== MESSAGE_MAGIC) {
            throw new Error('Consistency error');
        }
        res.push({
            seq: buff.readUInt32LE(),
            uid: buff.readUInt32LE(),
            mentions: buff.readUInt32Vector(),
            hiddenFor: buff.readUInt32Vector()
        });
    }
    return res;
}

export class CompactMessagesDirectory {
    private bucketSize: number;
    private directory: Subspace<TupleItem[], Buffer>;

    constructor(directory: Subspace<Buffer, Buffer>, bucketSize: number) {
        this.directory = directory
            .withKeyEncoding(encoders.tuple);

        this.bucketSize = bucketSize;
    }

    add = async (parent: Context, cid: number, message: CompactMessage) => {
        return await inTx(parent, async (ctx) => {
            let bucketNo = Math.ceil(message.seq / this.bucketSize);
            let bucket = await this.directory.get(ctx, [cid, bucketNo]);
            let messages = bucket ? unpackBucket(bucket) : [];

            if (messages.find(m => m.seq === message.seq)) {
                return;
            }

            messages.push(message);
            this.directory.set(ctx, [cid, bucketNo], packBucket(messages));
        });
    }

    remove = async (parent: Context, cid: number, seq: number) => {
        return await inTx(parent, async (ctx) => {
            let bucketNo = Math.ceil(seq / this.bucketSize);
            let bucket = await this.directory.get(ctx, [cid, bucketNo]);
            let messages = bucket ? unpackBucket(bucket) : [];

            if (!messages.find(m => m.seq === seq)) {
                return;
            }

            this.directory.set(ctx, [cid, bucketNo], packBucket(messages.filter(m => m.seq !== seq)));
        });
    }

    get = async (parent: Context, cid: number, from: number) => {
        let tx = getTransaction(parent).rawTransaction(this.directory.db);

        let bucketNo = Math.ceil(from / this.bucketSize);
        let fromBuffer = Buffer.concat([this.directory.prefix, encoders.tuple.pack([cid, bucketNo])]);
        let toBuffer = Buffer.concat([this.directory.prefix, encoders.tuple.pack([cid + 1])]);
        let batches = await tx.getRangeAll(fromBuffer, toBuffer);
        let all = batches.map(v => unpackBucket(v[1])).flat();

        return all.filter(msg => msg.seq >= from);
    }
}