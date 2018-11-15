import { encoders } from 'foundationdb';
import { createLogger } from 'openland-log/createLogger';
import { createEmptyContext } from 'openland-utils/Context';
// import { pack } from './TupleEncoder';

const byteFF = Buffer.alloc(1);
byteFF.writeUInt8(0xff, 0);
const byteZero = Buffer.alloc(1);
byteZero.writeUInt8(0, 0);
const log = createLogger('key-encoding');
export const FKeyEncoding = {
    encodeKey: (key: (string | boolean | number)[]) => {
        // try {
        //     pack(key);
        // } catch (e) {
        //     log.warn('Unable to encode key with new encoder!!', key, e);
        // }
        try {
            return encoders.tuple.pack(key) as Buffer;
        } catch (e) {
            log.warn(createEmptyContext(), 'Unable to encode key', key, e);
            throw e;
        }
    },
    encodeKeyToString: (key: (string | boolean | number)[]) => {
        return (encoders.tuple.pack(key) as Buffer).toString('hex');
    },
    encodeKeyForCli: (key: (string | boolean | number)[]) => {
        let bytes = encoders.tuple.pack(key) as Buffer;
        let converted = bytes.toString('hex');
        let res = '';
        for (let i = 0; i < bytes.length; i++) {
            res += '\\x' + converted[i * 2] + converted[i * 2 + 1];
        }
        return res;
    },
    decodeKey: (key: Buffer) => {
        let res = encoders.tuple.unpack(key);
        // try {
        //     pack(res as any);
        // } catch (e) {
        //     log.warn('Unable to encode key with new encoder!!', key, e);
        // }
        return res;
    },
    decodeFromString: (key: string) => {
        return encoders.tuple.unpack(Buffer.from(key, 'hex'));
    },
    lastKeyInSubspace: (key: (string | boolean | number)[]) => {
        let r = encoders.tuple.pack(key) as Buffer;
        return Buffer.concat([r, byteFF]);
    },
    firstKeyInSubspace: (key: (string | boolean | number)[]) => {
        let r = encoders.tuple.pack(key) as Buffer;
        return Buffer.concat([r, byteZero]);
    },
};