import { Context } from '@openland/context';
import { FSubspace } from './FSubspace';
import { decodeAtomic, encodeAtomic } from './utils/atomicEncode';

export class FAtomicInteger {
    private readonly key: Buffer;
    private readonly keySpace: FSubspace;

    constructor(key: Buffer, keySpace: FSubspace) {
        this.key = key;
        this.keySpace = keySpace;
    }

    get = async (ctx: Context) => {
        let r = await this.keySpace.get(ctx, this.key);
        if (r) {
            return decodeAtomic(r);
        } else {
            return null;
        }
    }
    set = (ctx: Context, value: number) => {
        this.keySpace.set(ctx, this.key, encodeAtomic(value));
    }
    increment = (ctx: Context) => {
        this.add(ctx, 1);
    }
    decrement = (ctx: Context) => {
        this.add(ctx, -1);
    }
    add = (ctx: Context, value: number) => {
        this.keySpace.add(ctx, this.key, encodeAtomic(value));
    }
}