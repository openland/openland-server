import { Context } from 'openland-utils/Context';
import { FConnection } from './FConnection';
import Transaction, { RangeOptions } from 'foundationdb/dist/lib/transaction';

export interface FTransaction {
    readonly isReadOnly: boolean;
    readonly isCompleted: boolean;

    beforeCommit(fn: ((ctx: Context) => Promise<void>) | (() => void)): void;
    afterCommit(fn: (ctx: Context) => void): void;

    rawTransaction(connection: FConnection): Transaction<Buffer, Buffer>;

    range(context: Context, connection: FConnection, key: Buffer, options?: RangeOptions): Promise<{ item: any, key: Buffer }[]>;
    rangeAll(context: Context, connection: FConnection, key: Buffer, options?: RangeOptions): Promise<any[]>;
    set(context: Context, connection: FConnection, key: Buffer, value: any): void;
}