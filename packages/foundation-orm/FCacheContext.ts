import { FBaseTransaction } from './utils/FBaseTransaction';
import { FEntity } from './FEntity';
import { FConnection } from './FConnection';
import { Context } from 'openland-utils/Context';

export class FCacheContext extends FBaseTransaction {
    readonly isReadOnly = true;
    readonly isCompleted = false;

    markDirty(context: Context, entity: FEntity, callback: (connection: FConnection) => Promise<void>) {
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

    protected createTransaction(connection: FConnection) {
        return connection.fdb.rawCreateTransaction({ causal_read_risky: true });
    }
}