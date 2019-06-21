import { Database, inTx, encoders } from '@openland/foundationdb';
import { backoff } from 'openland-utils/timer';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { createLogger } from '@openland/log';
import { createNamedContext } from '@openland/context';

const rootPrefix = Buffer.from('f0', 'hex');
const dataPrefix = Buffer.concat([rootPrefix, Buffer.from('02', 'hex')]);
const metaPrefix = Buffer.concat([rootPrefix, Buffer.from('fd', 'hex')]);
const regsPrefix = Buffer.concat([metaPrefix, Buffer.from('01', 'hex')]);
// const counterKey = Buffer.concat([metaPrefix, Buffer.from('02', 'hex')]);
const logger = createLogger('directory-allocator');

function buildDataPrefix(counter: number) {
    let res = Buffer.alloc(2);
    res.writeInt16BE(counter, 0);
    return Buffer.concat([dataPrefix, res]);
}

export class DirectoryAllocator {
    readonly connection: Database;
    readonly root: string[];

    constructor(connection: Database, root: string[]) {
        this.connection = connection;
        this.root = root;
    }

    async allocateDirectory(key: (string)[]) {
        let destKey = Buffer.concat([regsPrefix, FKeyEncoding.encodeKey([...key])]);
        try {
            return await backoff(async () => {
                return await inTx(createNamedContext('unknown'), async (ctx) => {

                    // Check New Directory
                    if (await this.connection.directories.exists(ctx, [...this.root, ...key])) {
                        return (await this.connection.directories.open(ctx, [...this.root, ...key]));
                    }

                    // Check old directory
                    let res = await this.connection.allKeys.get(ctx, destKey);
                    if (res) {
                        let p = buildDataPrefix(encoders.json.unpack(res).value as number);
                        return await this.connection.directories.createPrefix(ctx, [...this.root, ...key], p);
                    }

                    // Create new
                    return (await this.connection.directories.create(ctx, [...this.root, ...key]));
                });
            });
        } catch (e) {
            logger.warn(createNamedContext('unknown'), e);
            throw Error('Unable to allocate key!');
        }
    }

    async findAllDirectories() {
        let res = await this.connection.allKeys.range(createNamedContext('unknown'), regsPrefix);
        return res.map((v) => ({
            key: FKeyEncoding.decodeKey(v.key.slice(regsPrefix.length)).join('.'),
            id: buildDataPrefix(encoders.json.unpack(v.value).value).toString('hex')
        }));
    }
}