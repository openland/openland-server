import { keySelector } from 'foundationdb';
import { FContext } from './FContext';
import { FConnection } from './FConnection';
import { FEntity } from './FEntity';
import { Transaction } from 'foundationdb';
import { SafeContext } from 'openland-utils/SafeContext';
import { currentTime } from 'openland-server/utils/timer';
import { createLogger } from 'openland-log/createLogger';
import { RangeOptions } from 'foundationdb/dist/lib/transaction';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { FKeyEncoding } from './utils/FKeyEncoding';
import { trace, traceSync } from 'openland-log/trace';
import { tracer } from './utils/tracer';

const log = createLogger('tx');

export class FTransaction implements FContext {

    static readonly context = new SafeContext<FTransaction>();
    private static nextId = 1;

    readonly isReadOnly: boolean = false;
    readonly id = FTransaction.nextId++;
    tx: Transaction<NativeValue, any> | null = null;
    private _isCompleted = false;
    private connection: FConnection | null = null;
    private _pending = new Map<string, (connection: FConnection) => Promise<void>>();
    private pendingCallbacks: (() => void)[] = [];

    get isCompleted() {
        return this._isCompleted;
    }

    reset() {
        this.pendingCallbacks = [];
    }

    afterTransaction(callback: () => void) {
        this.pendingCallbacks.push(callback);
    }

    async range(connection: FConnection, key: (string | number)[], options?: RangeOptions) {
        this._prepare(connection);
        return await trace(tracer, 'range', async () => {
            let res = (await this.tx!.getRangeAll(FKeyEncoding.encodeKey(key), undefined, options));
            return res.map((v) => ({ item: v[1] as any, key: FKeyEncoding.decodeKey(v[0]) }));
        });
    }

    async rangeAfter(connection: FConnection, prefix: (string | number)[], afterKey: (string | number)[], options?: RangeOptions) {
        this._prepare(connection);
        return await trace(tracer, 'rangeAfter', async () => {
            let reversed = (options && options.reverse) ? true : false;
            let start = reversed ? FKeyEncoding.firstKeyInSubspace(prefix) : keySelector.firstGreaterThan(FKeyEncoding.encodeKey(afterKey));
            let end = reversed ? keySelector.lastLessOrEqual(FKeyEncoding.encodeKey(afterKey)) : FKeyEncoding.lastKeyInSubspace(prefix);
            let res = await this.tx!.getRangeAll(start, end, options);
            return res.map((v) => ({ item: v[1] as any, key: FKeyEncoding.decodeKey(v[0]) }));
        });
    }

    async get(connection: FConnection, key: (string | number)[]) {
        this._prepare(connection);
        return await trace(tracer, 'get', async () => {
            return await this.tx!.get(FKeyEncoding.encodeKey(key));
        });
    }
    set(connection: FConnection, key: Buffer, value: any) {
        this._prepare(connection);
        traceSync(tracer, 'set', () => {
            this.tx!.set(key, value);
        });
    }

    delete(connection: FConnection, key: Buffer) {
        this._prepare(connection);
        traceSync(tracer, 'delete', () => {
            this.tx!.clear(key);
        });
    }

    markDirty(entity: FEntity, callback: (connection: FConnection) => Promise<void>) {
        this._prepare(entity.connection);
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
        // if (this._hadMutations) {
        log.debug('flush time: ' + (currentTime() - t) + ' ms');
        // }
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

    private _prepare(connection: FConnection) {
        if (this.connection && this.connection !== connection) {
            throw Error('Unable to use two different connections in the same transaction');
        }
        if (this.connection) {
            return;
        }

        log.debug('started');
        this.connection = connection;
        this.tx = connection.fdb.rawCreateTransaction();
    }
}