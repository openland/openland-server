import { SafeContext } from 'openland-utils/SafeContext';
import { FBaseTransaction } from './utils/FBaseTransaction';
import { FEntity } from './FEntity';
import { FConnection } from './FConnection';

export class FCacheContext extends FBaseTransaction {
    static readonly context = new SafeContext<FCacheContext>();
    
    readonly isReadOnly = true;
    readonly isCompleted = false;
    private cache = new Map<string, any>();

    findInCache(key: string): any | null | undefined {
        if (this.cache.has(key)) {
            return this.cache.get(key);
        } else {
            return undefined;
        }
    }

    putInCache(key: string, value: any | null) {
        this.cache.set(key, value);
    }

    markDirty(entity: FEntity, callback: (connection: FConnection) => Promise<void>) {
        throw Error('Trying to write to read-only context');
    }
    set(connection: FConnection, key: Buffer, value: any) {
        throw Error('Trying to write to read-only context');
    }
    delete(connection: FConnection, key: Buffer) {
        throw Error('Trying to write to read-only context');
    }
    afterTransaction(callback: () => void) {
        throw Error('Trying to write to read-only context');
    }

    protected createTransaction(connection: FConnection) {
        return connection.fdb.rawCreateTransaction({ causal_read_risky: true });
    }
}