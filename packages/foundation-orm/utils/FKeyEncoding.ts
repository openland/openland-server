import { Tuple, encoders } from '@openland/foundationdb/lib/encoding';
import { createNamedContext } from '@openland/context';
import { createLogger } from '@openland/log';
// import { pack } from './TupleEncoder';

const byteFF = Buffer.alloc(1);
byteFF.writeUInt8(0xff, 0);
const byteZero = Buffer.alloc(1);
byteZero.writeUInt8(0, 0);
const log = createLogger('fdb');
const unknownContext = createNamedContext('unknown');

export const FKeyEncoding = {
    encodeKey: (key: Tuple[]) => {
        // try {
        //     pack(key);
        // } catch (e) {
        //     log.warn('Unable to encode key with new encoder!!', key, e);
        // }
        try {
            return encoders.tuple.pack(key) as Buffer;
        } catch (e) {
            log.warn(unknownContext, 'Unable to encode key', key, e);
            throw e;
        }
    },
    encodeKeyToString: (key: Tuple[]) => {
        return (encoders.tuple.pack(key) as Buffer).toString('hex');
    },
    decodeKey: (key: Buffer) => {
        let res = encoders.tuple.unpack(key);
        // try {
        //     pack(res as any);
        // } catch (e) {
        //     log.warn('Unable to encode key with new encoder!!', key, e);
        // }
        return res as Tuple[];
    },
    decodeFromString: (key: string) => {
        return encoders.tuple.unpack(Buffer.from(key, 'hex')) as Tuple[];
    },
    lastKeyInSubspaceBuf: (key: Buffer) => {
        // Invalid!
        return Buffer.concat([key, byteFF]);
    },
    firstKeyInSubspaceBuf: (key: Buffer) => {
        return Buffer.concat([key, byteZero]);
    },
};