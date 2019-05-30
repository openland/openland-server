import { FBaseTransaction } from './utils/FBaseTransaction';
import { FEntity } from './FEntity';
import { FConnection } from './FConnection';
import { Context } from 'openland-utils/Context';

export class FCacheContext extends FBaseTransaction {
    readonly isReadOnly = true;
    readonly isCompleted = false;

    // private cache = new Map<string, any>();

    // findInCache(key: string): any | null | undefined {
    //     if (this.cache.has(key)) {
    //         return this.cache.get(key);
    //     } else {
    //         return undefined;
    //     }
    // }

    // putInCache(key: string, value: any | null) {
    //     this.cache.set(key, value);
    // }

    markDirty(context: Context, entity: FEntity, callback: (ctx: Context) => Promise<void>) {
        throw Error('Trying to write to read-only context');
    }
    set(context: Context, connection: FConnection, key: Buffer, value: any) {
        throw Error('Trying to write to read-only context');
    }
    delete(context: Context, connection: FConnection, key: Buffer) {
        throw Error('Trying to write to read-only context');
    }
    afterTransaction(callback: () => void) {
        throw Error('Trying to write to read-only context');
    }
    atomicSet(context: Context, connection: FConnection, key: Buffer, value: number) {
        throw Error('Trying to write to read-only context');
    }
    atomicAdd(context: Context, connection: FConnection, key: Buffer, value: number) {
        throw Error('Trying to write to read-only context');
    }

    protected createTransaction(connection: FConnection) {
        return connection.fdb.rawCreateTransaction({ causal_read_risky: true });
    }
}