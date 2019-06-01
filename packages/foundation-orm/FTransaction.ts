import { Context } from 'openland-utils/Context';
import { FConnection } from './FConnection';
import Transaction, { RangeOptions } from 'foundationdb/dist/lib/transaction';

export interface FTransaction {
    readonly isReadOnly: boolean;
    readonly isCompleted: boolean;

    beforeCommit(fn: ((ctx: Context) => Promise<void>) | (() => void)): void;
    afterCommit(fn: (ctx: Context) => void): void;

    rawTransaction(connection: FConnection): Transaction<Buffer, Buffer>;

    get(context: Context, connection: FConnection, key: Buffer): Promise<any | null>;
    range(context: Context, connection: FConnection, key: Buffer, options?: RangeOptions): Promise<{ item: any, key: Buffer }[]>;
    rangeAll(context: Context, connection: FConnection, key: Buffer, options?: RangeOptions): Promise<any[]>;
    rangeAfter(context: Context, connection: FConnection, prefix: (string | number)[], afterKey: (string | number)[], options?: RangeOptions): Promise<{ item: any, key: Buffer }[]>;
    set(context: Context, connection: FConnection, key: Buffer, value: any): void;
    delete(context: Context, connection: FConnection, key: Buffer): void;
}