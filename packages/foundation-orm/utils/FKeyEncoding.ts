import { encoders } from 'foundationdb';

const byteFF = Buffer.alloc(1);
byteFF.writeUInt8(0xff, 0);
const byteZero = Buffer.alloc(1);
byteZero.writeUInt8(0, 0);
export const FKeyEncoding = {
    encodeKey: (key: (string | boolean | number)[]) => {
        try {
            return encoders.tuple.pack(key) as Buffer;
        } catch (e) {
            console.warn('Unable to encode key', key, e);
            throw e;
        }
    },
    encodeKeyToString: (key: (string | boolean | number)[]) => {
        return (encoders.tuple.pack(key) as Buffer).toString('hex');
    },
    decodeKey: (key: Buffer) => {
        return encoders.tuple.unpack(key);
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