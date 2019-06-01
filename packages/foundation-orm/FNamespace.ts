import { FConnection } from './FConnection';
import { RangeOptions } from 'foundationdb/dist/lib/transaction';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { Context } from 'openland-utils/Context';
import { getTransaction } from './getTransaction';

export class FNamespace {
    readonly namespace: (string | number)[];

    constructor(...namespace: (string | number)[]) {
        this.namespace = namespace;
    }

    get = async (ctx: Context, connection: FConnection, key: (string | number)[]) => {
        return getTransaction(ctx).get(ctx, connection, FKeyEncoding.encodeKey([...this.namespace, ...key]));
    }

    range = async (ctx: Context, connection: FConnection, key: (string | number)[], options?: RangeOptions) => {
        return getTransaction(ctx).range(ctx, connection, FKeyEncoding.encodeKey([...this.namespace, ...key]), options);
    }

    rangeAfter = async (ctx: Context, connection: FConnection, key: (string | number)[], after: (string | number)[], options?: RangeOptions) => {
        return getTransaction(ctx).rangeAfter(ctx, connection, [...this.namespace, ...key], [...after], options);
    }

    set = (ctx: Context, connection: FConnection, key: (string | number)[], value: any) => {
        getTransaction(ctx).set(ctx, connection, FKeyEncoding.encodeKey([...this.namespace, ...key]), value);
    }

    delete = (ctx: Context, connection: FConnection, key: (string | number)[]) => {
        getTransaction(ctx).delete(ctx, connection, FKeyEncoding.encodeKey([...this.namespace, ...key]));
    }
}