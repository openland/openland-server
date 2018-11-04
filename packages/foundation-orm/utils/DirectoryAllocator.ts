import { FConnection } from 'foundation-orm/FConnection';
import { FKeyEncoding } from './FKeyEncoding';

const rootPrefix = Buffer.from('f0', 'hex');
const dataPrefix = Buffer.concat([rootPrefix, Buffer.from('01', 'hex')]);
const metaPrefix = Buffer.concat([rootPrefix, Buffer.from('fe', 'hex')]);
const regsPrefix = Buffer.concat([metaPrefix, Buffer.from('01', 'hex')]);
const counterKey = Buffer.concat([metaPrefix, Buffer.from('02', 'hex')]);

function buildDataPrefix(counter: number) {
    let res = new Buffer(2);
    res.writeInt16BE(counter, 0);
    return Buffer.concat([dataPrefix, res]);
}

export class DirectoryAllocator {
    readonly connection: FConnection;

    constructor(connection: FConnection) {
        this.connection = connection;
    }

    async allocateDirectory(key: (string | number | boolean)[]) {
        let destKey = Buffer.concat([regsPrefix, FKeyEncoding.encodeKey([...key])]);
        return await this.connection.fdb.doTransaction(async (tx) => {
            let res = await tx.get(destKey);
            if (res) {
                return buildDataPrefix(res.value as number);
            }
            let nextPrefix = await tx.get(counterKey);
            let nextCounter = 1;
            if (!nextPrefix) {
                tx.set(counterKey, { value: 1 });
            } else {
                nextCounter = (nextPrefix.value as number) + 1;
                tx.set(counterKey, { value: nextPrefix + 1 });
            }
            if (nextCounter > 6536) {
                throw Error('Key space overflowed');
            }
            tx.set(destKey, { value: nextCounter });
            return buildDataPrefix(nextCounter);
        });
    }
}