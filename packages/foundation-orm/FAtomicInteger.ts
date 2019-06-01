import { Context } from 'openland-utils/Context';
import { FOperations } from './FOperations';
import { decodeAtomic, encodeAtomic } from './utils/atomicEncode';

export class FAtomicInteger {
    private readonly key: Buffer;
    private readonly ops: FOperations;

    constructor(key: Buffer, ops: FOperations) {
        this.key = key;
        this.ops = ops;
    }

    get = async (ctx: Context) => {
        let r = await this.ops.get(ctx, this.key);
        if (r) {
            return decodeAtomic(r);
        } else {
            return null;
        }
    }
    set = (ctx: Context, value: number) => {
        this.ops.set(ctx, this.key, encodeAtomic(value));
    }
    increment = (ctx: Context) => {
        this.add(ctx, 1);
    }
    decrement = (ctx: Context) => {
        this.add(ctx, -1);
    }
    add = (ctx: Context, value: number) => {
        this.ops.add(ctx, this.key, encodeAtomic(value));
    }
}