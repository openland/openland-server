import { FConnection } from './FConnection';
import { FEntity } from './FEntity';
import { SafeContext } from 'openland-utils/SafeContext';
import { currentTime } from 'openland-utils/timer';
import { createLogger } from 'openland-log/createLogger';
import { trace, traceSync } from 'openland-log/trace';
import { tracer, logger } from './utils/tracer';
import { FBaseTransaction } from './utils/FBaseTransaction';

const log = createLogger('tx');

export class FTransaction extends FBaseTransaction {

    static readonly context = new SafeContext<FTransaction>();

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

    set(connection: FConnection, key: Buffer, value: any) {
        this.prepare(connection);
        traceSync(tracer, 'set', () => {
            logger.debug('set');
            this.tx!.set(key, value);
        });
    }

    delete(connection: FConnection, key: Buffer) {
        this.prepare(connection);
        traceSync(tracer, 'delete', () => {
            logger.debug('delete');
            this.tx!.clear(key);
        });
    }

    markDirty(entity: FEntity, callback: (connection: FConnection) => Promise<void>) {
        logger.debug('markDirty');
        this.prepare(entity.connection);
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

    async flushPending() {
        if (this._isCompleted) {
            return;
        }
        if (!this.connection) {
            return;
        }

        let t = currentTime();
        await trace(tracer, 'flush', async () => {
            let pend = [...this._pending.values()];
            this._pending.clear();
            for (let p of pend) {
                await p(this.connection!);
            }
        });
        log.debug('flush time: ' + (currentTime() - t) + ' ms');
    }

    async flush() {
        if (this._isCompleted) {
            return;
        }
        if (!this.connection) {
            return;
        }

        // Do not need to parallel things since client will batch everything for us
        let t = currentTime();
        await trace(tracer, 'flush', async () => {
            for (let p of this._pending.values()) {
                await p(this.connection!);
            }
        });
        log.debug('flush time: ' + (currentTime() - t) + ' ms');
        t = currentTime();
        await trace(tracer, 'commit', async () => {
            await this.tx!!.rawCommit();
        });
        if (this.pendingCallbacks.length > 0) {
            await trace(tracer, 'hooks', async () => {
                for (let p of this.pendingCallbacks) {
                    p();
                }
            });
        }
        this._isCompleted = true;
        // if (this._hadMutations) {
        log.debug('commit time: ' + (currentTime() - t) + ' ms');
        // }
    }

    protected createTransaction(connection: FConnection) {
        return connection.fdb.rawCreateTransaction();
    }
}