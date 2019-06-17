import { FSubspace } from './FSubspace';
import { Context } from '@openland/context';

const zero = Buffer.of();
const one = Buffer.from('ff', 'hex');

export class FAtomicBoolean {
    private readonly key: Buffer;
    private readonly keySpace: FSubspace;

    constructor(key: Buffer, keySpace: FSubspace) {
        this.key = key;
        this.keySpace = keySpace;
    }

    get = async (ctx: Context) => {
        let r = await this.keySpace.get(ctx, this.key);
        if (r) {
            return r.length > 0;
        } else {
            return false;
        }
    }
    set = (ctx: Context, value: boolean) => {
        if (value) {
            this.keySpace.set(ctx, this.key, one);
        } else {
            this.keySpace.set(ctx, this.key, zero);
        }
    }
    invert = (ctx: Context) => {
        this.keySpace.bitXor(ctx, this.key, one);
    }
}