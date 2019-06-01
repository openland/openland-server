import { FConnection } from './FConnection';
import { FEntity } from './FEntity';
// import { createLogger } from 'openland-log/createLogger';
import { tracer } from './utils/tracer';
import { FBaseTransaction } from './utils/FBaseTransaction';
import { Context } from 'openland-utils/Context';

// const log = createLogger('tx', false);

export class FTransactionReadWrite extends FBaseTransaction {

    readonly isReadOnly: boolean = false;
    private _pending = new Map<string, (ctx: Context) => Promise<void>>();
    private pendingCallbacks: (() => void)[] = [];
    private _isCompleted = false;

    get isCompleted() {
        return this._isCompleted;
    }

    afterTransaction(callback: () => void) {
        this.pendingCallbacks.push(callback);
    }

    markDirty(parent: Context, entity: FEntity, callback: (ctx: Context) => Promise<void>) {
        this.prepare(parent, entity.connection);
        let key = [...entity.namespace.namespace, ...entity.rawId].join('.');
        this._pending.set(key, callback);
    }

    async abort() {
        if (this._isCompleted) { 
            return;
        }
        this._isCompleted = true;

        if (!this.connection) {
            return;
        }

        await this.tx!.abort();
    }

    async flushPending(parent: Context) {
        if (this._isCompleted) {
            return;
        }
        if (!this.connection) {
            return;
        }

        let pend = [...this._pending.values()];
        this._pending.clear();
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
        await tracer.trace(parent, 'tx-flush', async (ctx) => {
            for (let p of this._pending.values()) {
                await p(ctx);
            }
        });
        await tracer.trace(parent, 'tx-commit', async () => {
            await this.tx!.commit();
        });
        if (this.pendingCallbacks.length > 0) {
            await tracer.trace(parent, 'tx-hooks', async () => {
                for (let p of this.pendingCallbacks) {
                    p();
                }
            });
        }

        this._isCompleted = true;
    }

    protected createTransaction(connection: FConnection) {
        return connection.fdb.rawCreateTransaction();
    }
}