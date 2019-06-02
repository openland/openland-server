import { FConnection } from '../FConnection';
import { tracer } from '../utils/tracer';
import { FBaseTransaction } from './FBaseTransaction';
import { Context } from '@openland/context';

// const log = createLogger('tx', false);

export class FTransactionReadWrite extends FBaseTransaction {

    readonly isReadOnly: boolean = false;
    private _beforeCommit: (((ctx: Context) => void) | ((ctx: Context) => Promise<void>))[] = [];
    private _afterCommit: ((ctx: Context) => void)[] = [];
    private _isCompleted = false;

    get isCompleted() {
        return this._isCompleted;
    }

    beforeCommit(fn: ((ctx: Context) => void) | ((ctx: Context) => Promise<void>)) {
        this._beforeCommit.push(fn);
    }

    afterCommit(fn: (ctx: Context) => void) {
        this._afterCommit.push(fn);
    }

    async abort() {
        if (this._isCompleted) {
            return;
        }
        this._isCompleted = true;

        if (!this.connection) {
            return;
        }

        await this.rawTx.rawCancel();
    }

    async flushPending(parent: Context) {
        if (this._isCompleted) {
            return;
        }
        if (!this.connection) {
            return;
        }

        let pend = [...this._beforeCommit];
        this._beforeCommit = [];
        if (pend.length > 0) {
            await tracer.trace(parent, 'tx-flush-pending', async (ctx) => {
                for (let p of pend) {
                    await p(ctx);
                }
            });
        }
    }

    async flush(parent: Context) {
        if (this._isCompleted) {
            return;
        }
        if (!this.connection) {
            return;
        }

        // Do not need to parallel things since client will batch everything for us
        let pend = [...this._beforeCommit];
        this._beforeCommit = [];
        await tracer.trace(parent, 'tx-flush', async (ctx) => {
            for (let p of pend) {
                await p(ctx);
            }
        });
        await tracer.trace(parent, 'tx-commit', async () => {
            await this.rawTx.rawCommit();
        });
        let pend2 = [...this._afterCommit];
        this._afterCommit = [];
        if (pend2.length > 0) {
            await tracer.trace(parent, 'tx-hooks', async (ctx) => {
                for (let p of pend2) {
                    p(ctx);
                }
            });
        }

        this._isCompleted = true;
    }

    async handleError(code: number) {
        await this.rawTx.rawOnError(code);
    }

    protected createTransaction(connection: FConnection) {
        return connection.fdb.rawCreateTransaction();
    }
}