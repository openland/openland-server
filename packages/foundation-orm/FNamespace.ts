import { FConnection } from './FConnection';
import { RangeOptions } from 'foundationdb/dist/lib/transaction';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { Context } from 'openland-utils/Context';
import { getTransaction } from './getTransaction';
import { FOperations } from './FOperations';
import { FTuple } from './FTuple';
import { FEncoders } from './FEncoders';

export class FNamespace {
    readonly namespace: (string | number)[];
    readonly ops: FOperations<FTuple[], any>;
    private readonly prefix: Buffer;
    private readonly connection: FConnection;

    constructor(connection: FConnection, ...namespace: (string | number)[]) {
        this.namespace = namespace;
        this.ops = connection.ops
            .withKeyEncoding(FEncoders.tuple)
            .withValueEncoding(FEncoders.json)
            .subspace(namespace);
        this.connection = connection;
        this.prefix = FKeyEncoding.encodeKey(namespace);
    }

    range = async (ctx: Context, key: (string | number)[], options?: RangeOptions) => {
        return getTransaction(ctx).range(ctx, this.connection, Buffer.concat([this.prefix, FKeyEncoding.encodeKey(key)]), options);
    }

    rangeAfter = async (ctx: Context, key: (string | number)[], after: (string | number)[], options?: RangeOptions) => {
        return getTransaction(ctx).rangeAfter(ctx, this.connection, [...this.namespace, ...key], [...after], options);
    }
}