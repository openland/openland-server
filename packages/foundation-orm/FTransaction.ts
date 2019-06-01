import { Context } from 'openland-utils/Context';
import { FEntity } from './FEntity';
import { FConnection } from './FConnection';
import { RangeOptions } from 'foundationdb/dist/lib/transaction';

export interface FTransaction {
    readonly isReadOnly: boolean;
    readonly isCompleted: boolean;

    markDirty(parent: Context, entity: FEntity, callback: (ctx: Context) => Promise<void>): void;
    get(context: Context, connection: FConnection, key: Buffer): Promise<any | null>;
    range(context: Context, connection: FConnection, key: Buffer, options?: RangeOptions): Promise<{ item: any, key: Buffer }[]>;
    rangeAll(context: Context, connection: FConnection, key: Buffer, options?: RangeOptions): Promise<any[]>;
    rangeAfter(context: Context, connection: FConnection, prefix: (string | number)[], afterKey: (string | number)[], options?: RangeOptions): Promise<{ item: any, key: Buffer }[]>;
    set(context: Context, connection: FConnection, key: Buffer, value: any): void;
    delete(context: Context, connection: FConnection, key: Buffer): void;
    afterTransaction(callback: () => void): void;

    atomicSet(context: Context, connection: FConnection, key: Buffer, value: number): void;
    atomicAdd(context: Context, connection: FConnection, key: Buffer, value: number): void;
    atomicGet(context: Context, connection: FConnection, key: Buffer): Promise<number | null>;
}