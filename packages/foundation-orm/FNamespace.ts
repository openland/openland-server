import { FConnection } from './FConnection';
import { RangeOptions } from 'foundationdb/dist/lib/transaction';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { Context } from 'openland-utils/Context';
import { getTransaction } from './getTransaction';
import { FOperations } from './FOperations';
import { encoders } from 'foundationdb';

export class FNamespace {
    readonly namespace: (string | number)[];
    private readonly prefix: Buffer;
    private readonly connection: FConnection;
    private readonly ops: FOperations;

    constructor(connection: FConnection, ...namespace: (string | number)[]) {
        this.namespace = namespace;
        this.ops = connection.ops;
        this.connection = connection;
        this.prefix = FKeyEncoding.encodeKey(namespace);
    }

    get = async (ctx: Context, key: (string | number)[]) => {
        let res = await this.ops.get(ctx, Buffer.concat([this.prefix, FKeyEncoding.encodeKey(key)]));
        if (res) {
            return encoders.json.unpack(res);
        } else {
            return null;
        }
    }

    range = async (ctx: Context, key: (string | number)[], options?: RangeOptions) => {
        return getTransaction(ctx).range(ctx, this.connection, Buffer.concat([this.prefix, FKeyEncoding.encodeKey(key)]), options);
    }

    rangeAfter = async (ctx: Context, key: (string | number)[], after: (string | number)[], options?: RangeOptions) => {
        return getTransaction(ctx).rangeAfter(ctx, this.connection, [...this.namespace, ...key], [...after], options);
    }

    set = (ctx: Context, key: (string | number)[], value: any) => {
        getTransaction(ctx).set(ctx, this.connection, Buffer.concat([this.prefix, FKeyEncoding.encodeKey(key)]), value);
    }

    delete = (ctx: Context, key: (string | number)[]) => {
        getTransaction(ctx).delete(ctx, this.connection, Buffer.concat([this.prefix, FKeyEncoding.encodeKey(key)]));
    }
}