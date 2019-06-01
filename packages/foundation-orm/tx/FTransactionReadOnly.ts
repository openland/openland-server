import { FBaseTransaction } from './FBaseTransaction';
import { FConnection } from '../FConnection';
import { Context } from 'openland-utils/Context';

export class FTransactionReadOnly extends FBaseTransaction {
    readonly isReadOnly = true;
    readonly isCompleted = false;

    beforeCommit(fn: ((ctx: Context) => Promise<void>) | (() => void)) {
        throw Error('Trying to write to read-only context');
    }
    afterCommit(fn: (ctx: Context) => void) {
        throw Error('Trying to write to read-only context');
    }

    protected createTransaction(connection: FConnection) {
        return connection.fdb.rawCreateTransaction({ causal_read_risky: true }).snapshot();
    }
}