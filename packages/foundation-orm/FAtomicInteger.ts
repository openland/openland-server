import { Context } from 'openland-utils/Context';
import { FConnection } from './FConnection';
import { getTransaction } from './getTransaction';

export class FAtomicInteger {

    private readonly key: Buffer;
    private readonly connection: FConnection;
    constructor(key: Buffer, connection: FConnection) {
        this.key = key;
        this.connection = connection;
    }

    get = async (ctx: Context) => {
        let cont = getTransaction(ctx);
        return await cont.atomicGet(ctx, this.connection, this.key);
    }
    set = (ctx: Context, value: number) => {
        let cont = getTransaction(ctx);
        cont.atomicSet(ctx, this.connection, this.key, value);
    }
    increment = (ctx: Context) => {
        this.add(ctx, 1);
    }
    decrement = (ctx: Context) => {
        this.add(ctx, -1);
    }
    add = (ctx: Context, value: number) => {
        let cont = getTransaction(ctx);
        cont.atomicAdd(ctx, this.connection, this.key, value);
    }
}