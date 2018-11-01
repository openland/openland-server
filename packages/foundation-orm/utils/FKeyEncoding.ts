// import { createLogger } from 'openland-log/createLogger';
import { pack, unpack } from './TupleEncoder';
import { FKeyType } from 'foundation-orm/FKeyType';

const byteFF = Buffer.alloc(1);
byteFF.writeUInt8(0xff, 0);
const byteZero = Buffer.alloc(1);
byteZero.writeUInt8(0, 0);
// const log = createLogger('key-encoding');
export const FKeyEncoding = {
    encodeKey: (key: FKeyType) => {
        return pack(key);
        // try {
        //     return pack(key);
        // } catch (e) {
        //     log.warn('Unable to encode key with new encoder!!', key, e);
        // }
        // try {
        //     return encoders.tuple.pack(key) as Buffer;
        // } catch (e) {
        //     log.warn('Unable to encode key', key, e);
        //     throw e;
        // }
    },
    encodeKeyToString: (key: FKeyType) => {
        return pack(key).toString('hex');
    },
    encodeKeyForCli: (key: FKeyType) => {
        let bytes = pack(key);
        let converted = bytes.toString('hex');
        let res = '';
        for (let i = 0; i < bytes.length; i++) {
            res += '\\x' + converted[i * 2] + converted[i * 2 + 1];
        }
        return res;
    },
    decodeKey: (key: Buffer) => {
        return unpack(key);
    },
    decodeFromString: (key: string) => {
        return unpack(Buffer.from(key, 'hex'));
    },
    lastKeyInSubspace: (key: FKeyType) => {
        let r = pack(key);
        return Buffer.concat([r, byteFF]);
    },
    firstKeyInSubspace: (key: FKeyType) => {
        let r = pack(key);
        return Buffer.concat([r, byteZero]);
    },
};