import * as async_hooks from 'async_hooks';
import { FContext } from './FContext';
import { FConnection } from './FConnection';
import { FEntity } from './FEntity';
import { Transaction, TupleItem } from 'foundationdb';
// import { currentTime } from 'openland-server/utils/timer';

var transactions = new Map<number, FTransaction>();

const asyncHook = async_hooks.createHook({
    init: (asyncId, type, triggerAsyncId, resource) => {
        let tx = transactions.get(triggerAsyncId);
        if (tx) {
            transactions.set(asyncId, tx);
        }
    },
    destroy: (asyncId) => {
        transactions.delete(asyncId);
    }
});

asyncHook.enable();

export class FTransaction implements FContext {

    static get currentTransaction(): FTransaction | null {
        let id = async_hooks.executionAsyncId();
        let tx = transactions.get(id);
        if (tx) {
            return tx;
        }
        return null;
    }

    static set currentTransaction(tx: FTransaction | null) {
        let id = async_hooks.executionAsyncId();
        if (tx) {
            transactions.set(id, tx);
        } else {
            transactions.delete(id);
        }
    }

    readonly isReadOnly: boolean = false;
    tx: Transaction<TupleItem[], any> | null = null;
    private _isCompleted = false;
    private connection: FConnection | null = null;
    private _pending = new Map<string, (connection: FConnection) => Promise<void>>();

    get isCompleted() {
        return this._isCompleted;
    }

    async get(connection: FConnection, ...key: (string | number)[]) {
        this._prepare(connection);
        return this.tx!.get(key);
    }
    async set(connection: FConnection, value: any, ...key: (string | number)[]) {
        this._prepare(connection);
        this.tx!.set(key, value);
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

        // let t = currentTime();
        await this.tx!!.rawCommit();
        this._isCompleted = true;
        // console.log('Transaction commit time: ' + (currentTime() - t) + ' ms');
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