import { FConnection } from 'foundation-orm/FConnection';
import { backoff } from 'openland-utils/timer';
import { encoders } from 'foundationdb';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { createLogger } from '@openland/log';
import { createNamedContext } from '@openland/context';

const rootPrefix = Buffer.from('f0', 'hex');
const dataPrefix = Buffer.concat([rootPrefix, Buffer.from('02', 'hex')]);
const metaPrefix = Buffer.concat([rootPrefix, Buffer.from('fd', 'hex')]);
const regsPrefix = Buffer.concat([metaPrefix, Buffer.from('01', 'hex')]);
const counterKey = Buffer.concat([metaPrefix, Buffer.from('02', 'hex')]);
const logger = createLogger('directory-allocator');

function buildDataPrefix(counter: number) {
    let res = Buffer.alloc(2);
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
        try {
            return await backoff(async () => await this.connection.fdb.doTransaction(async (tx) => {
                let res = await tx.get(destKey);
                if (res) {
                    return buildDataPrefix(encoders.json.unpack(res).value as number);
                }
                let nextPrefix = await tx.get(counterKey);
                let nextCounter = 1;
                if (!nextPrefix) {
                    tx.set(counterKey, encoders.json.pack({ value: 1 }) as Buffer);
                } else {
                    nextCounter = (encoders.json.unpack(nextPrefix).value as number) + 1;
                    tx.set(counterKey, encoders.json.pack({ value: nextCounter }) as Buffer);
                }
                if (nextCounter > 6536) {
                    throw Error('Key space overflowed');
                }
                tx.set(destKey, encoders.json.pack({ value: nextCounter }) as Buffer);
                return buildDataPrefix(nextCounter);
            }));
        } catch (e) {
            logger.warn(createNamedContext('unknown'), e);
            throw Error('Unable to allocate key!');
        }
    }

    async findAllDirectories() {
        let res = await this.connection.fdb.getRangeAll(regsPrefix);
        return res.map((v) => ({
            key: FKeyEncoding.decodeKey(v[0].slice(regsPrefix.length)).join('.'),
            id: buildDataPrefix(encoders.json.unpack(v[1]).value).toString('hex')
        }));
    }
}