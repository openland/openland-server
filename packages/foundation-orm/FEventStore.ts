import { FConnection } from './FConnection';
import { inTxLeaky, inTx } from './inTx';
import { Context } from '@openland/context';
import { FTuple } from './encoding/FTuple';
import { FEncoders } from './encoding/FEncoders';
import { FSubspace } from './FSubspace';
import { FRangeOptions } from './FRangeOptions';

export class FEventStore {
    readonly name: string;
    readonly connection: FConnection;
    readonly keyspace: FSubspace<Buffer, any>;

    constructor(name: string, connection: FConnection) {
        this.name = name;
        this.connection = connection;
        this.keyspace = this.connection.keySpace
            .withValueEncoding(FEncoders.json)
            .subspace(FEncoders.tuple.pack(['events', this.name]));
    }

    async create(parent: Context, key: FTuple[], shape: any) {
        await inTxLeaky(parent, async (ctx) => {
            this.keyspace.setWithVerstionstampUnique(ctx, FEncoders.tuple.pack(key), shape);
        });
    }

    async findAll(parent: Context, key: FTuple[]) {
        return await inTx(parent, async (ctx) => {
            return (await this.keyspace
                .subspace(FEncoders.tuple.pack(key))
                .range(ctx, Buffer.of()));
        });
    }

    async range(parent: Context, key: FTuple[], opts?: FRangeOptions<Buffer>) {
        return await inTx(parent, async (ctx) => {
            return (await this.keyspace
                .subspace(FEncoders.tuple.pack(key))
                .range(ctx, Buffer.of(), opts));
        });
    }
}