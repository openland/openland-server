import { FConnection } from './FConnection';
import { FEntity } from './FEntity';
import { currentTime } from 'openland-utils/timer';
import { createLogger } from 'openland-log/createLogger';
import { tracer, logger } from './utils/tracer';
import { FBaseTransaction } from './utils/FBaseTransaction';
import { Context } from 'openland-utils/Context';

const log = createLogger('tx', false);

export class FTransaction extends FBaseTransaction {

    readonly isReadOnly: boolean = false;
    private _pending = new Map<string, (connection: FConnection) => Promise<void>>();
    private pendingCallbacks: (() => void)[] = [];
    private _isCompleted = false;

    get isCompleted() {
        return this._isCompleted;
    }

    reset() {
        this.pendingCallbacks = [];
    }

    afterTransaction(callback: () => void) {
        this.pendingCallbacks.push(callback);
    }

    set(parent: Context, connection: FConnection, key: Buffer, value: any) {
        this.prepare(parent, connection);
        tracer.traceSync(parent, 'set', (ctx) => {
            logger.debug(ctx, 'set');
            this.tx!.set(key, value);
        });
    }

    delete(parent: Context, connection: FConnection, key: Buffer) {
        this.prepare(parent, connection);
        tracer.traceSync(parent, 'delete', (ctx) => {
            logger.debug(ctx, 'delete');
            this.tx!.clear(key);
        });
    }

    markDirty(parent: Context, entity: FEntity, callback: (connection: FConnection) => Promise<void>) {
        logger.debug(parent, 'markDirty');
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

        await this.tx!!.rawCancel();
    }

    async flushPending(parent: Context) {
        if (this._isCompleted) {
            return;
        }
        if (!this.connection) {
            return;
        }

        let t = currentTime();
        await tracer.trace(parent, 'flush', async () => {
            let pend = [...this._pending.values()];
            this._pending.clear();
            for (let p of pend) {
                await p(this.connection!);
            }
        });
        log.debug(parent, 'flush time: ' + (currentTime() - t) + ' ms');
    }

    async flush(parent: Context) {
        if (this._isCompleted) {
            return;
        }
        if (!this.connection) {
            return;
        }

        // Do not need to parallel things since client will batch everything for us
        let t = currentTime();
        await tracer.trace(parent, 'flush', async () => {
            for (let p of this._pending.values()) {
                await p(this.connection!);
            }
        });
        log.debug(parent, 'flush time: ' + (currentTime() - t) + ' ms');
        t = currentTime();
        await tracer.trace(parent, 'commit', async () => {
            await this.concurrencyPool!.run(() => this.tx!!.rawCommit());
        });
        if (this.pendingCallbacks.length > 0) {
            await tracer.trace(parent, 'hooks', async () => {
                for (let p of this.pendingCallbacks) {
                    p();
                }
            });
        }
        this._isCompleted = true;
        // if (this._hadMutations) {
        log.debug(parent, 'commit time: ' + (currentTime() - t) + ' ms');
        // }
    }

    protected createTransaction(connection: FConnection) {
        return connection.fdb.rawCreateTransaction();
    }
}