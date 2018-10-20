import { FContext } from './FContext';
import { FConnection } from './FConnection';
import { FEntity } from './FEntity';
import { Transaction, TupleItem } from 'foundationdb';
import { SafeContext } from 'openland-utils/SafeContext';
import { currentTime } from 'openland-server/utils/timer';

export class FTransaction implements FContext {

    static readonly context = new SafeContext<FTransaction>('fdbtx');
    private static nextId = 1;

    readonly isReadOnly: boolean = false;
    readonly id = FTransaction.nextId++;
    tx: Transaction<TupleItem[], any> | null = null;
    private _isCompleted = false;
    private connection: FConnection | null = null;
    private _pending = new Map<string, (connection: FConnection) => Promise<void>>();

    get isCompleted() {
        return this._isCompleted;
    }

    async range(connection: FConnection, limit: number, ...key: (string | number)[]) {
        let ex = FTransaction.context.value;
        this._prepare(connection);
        let res = (await this.tx!.getRangeAll(key, undefined, { limit })).map((v) => v[1]);
        FTransaction.context.value = ex;
        return res;
    }

    async get(connection: FConnection, ...key: (string | number)[]) {
        let ex = FTransaction.context.value;
        this._prepare(connection);
        let res = await this.tx!.get(key);
        FTransaction.context.value = ex;
        return res;
    }
    async set(connection: FConnection, value: any, ...key: (string | number)[]) {
        let ex = FTransaction.context.value;
        this._prepare(connection);
        this.tx!.set(key, value);
        FTransaction.context.value = ex;
    }

    async delete(connection: FConnection, ...key: (string | number)[]) {
        this._prepare(connection);
        this.tx!.clear(key);
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
        for (let p of this._pending.values()) {
            await p(this.connection!);
        }

        let t = currentTime();
        await this.tx!!.rawCommit();
        this._isCompleted = true;
        console.log('[' + this.id + '] Transaction commit time: ' + (currentTime() - t) + ' ms');
    }

    private _prepare(connection: FConnection) {
        if (this.connection && this.connection !== connection) {
            throw Error('Unable to use two different connections in the same transaction');
        }
        if (this.connection) {
            return;
        }

        this.connection = connection;
        this.tx = connection.fdb.rawCreateTransaction();
    }
}