import { FTransformer } from './FTransformer';
import { FKeyEncoding } from '../utils/FKeyEncoding';
import { FTuple } from './FTuple';

const zero = Buffer.of();
const one = Buffer.from('ff', 'hex');

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

const booleanTransformer: FTransformer<Buffer, boolean> = {
    unpack(src: Buffer) {
        return src.length > 0;
    },
    pack(src: boolean) {
        if (src) {
            return one;
        } else {
            return zero;
        }
    }
};

export const FEncoders = {
    json: jsonTransformer,
    tuple: tupleTransformer,
    boolean: booleanTransformer,
    id: <T>(): FTransformer<T, T> => {
        return {
            pack: (src: T) => src,
            unpack: (src: T) => src
        };
    }
};