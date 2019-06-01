import { FTransformer } from './FTransformer';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { FTuple } from './FTuple';

const jsonTransformer: FTransformer<Buffer, any> = {
    unpack(src: Buffer) {
        return JSON.parse(src.toString('utf-8'));
    },
    pack(src: any) {
        return Buffer.from(JSON.stringify(src), 'utf-8');
    }
};
const tupleTransformer: FTransformer<Buffer, FTuple[]> = {
    unpack(src: Buffer) {
        return FKeyEncoding.decodeKey(src);
    },
    pack(src: FTuple[]) {
        return FKeyEncoding.encodeKey(src);
    }
};

export const FEncoders = {
    json: jsonTransformer,
    tuple: tupleTransformer,
    id: <T>(): FTransformer<T, T> => {
        return {
            pack: (src: T) => src,
            unpack: (src: T) => src
        };
    }
};