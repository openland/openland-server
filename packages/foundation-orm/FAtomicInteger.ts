import { Context } from 'openland-utils/Context';
import { resolveContext } from './utils/contexts';
import { FConnection } from './FConnection';

export class FAtomicInteger {

    private readonly key: Buffer;
    private readonly connection: FConnection;
    constructor(key: Buffer, connection: FConnection) {
        this.key = key;
        this.connection = connection;
    }

    get = async (ctx: Context) => {
        let cont = resolveContext(ctx);
        return await cont.atomicGet(ctx, this.connection, this.key);
    }
    set = (ctx: Context, value: number) => {
        let cont = resolveContext(ctx);
        cont.atomicSet(ctx, this.connection, this.key, value);
    }
}