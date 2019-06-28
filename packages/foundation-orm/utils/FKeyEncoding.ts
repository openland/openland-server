import { Tuple, encoders } from '@openland/foundationdb';

const byteFF = Buffer.alloc(1);
byteFF.writeUInt8(0xff, 0);
const byteZero = Buffer.alloc(1);
byteZero.writeUInt8(0, 0);

export const FKeyEncoding = {
    encodeKeyToString: (key: Tuple[]) => {
        return (encoders.tuple.pack(key) as Buffer).toString('hex');
    },
    decodeFromString: (key: string) => {
        return encoders.tuple.unpack(Buffer.from(key, 'hex')) as Tuple[];
    },
};