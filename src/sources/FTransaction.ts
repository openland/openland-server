import * as async_hooks from 'async_hooks';
import * as fdb from 'foundationdb';
import { FDBConnection } from './init';
import Transaction from 'foundationdb/dist/lib/transaction';
import { TupleItem } from 'foundationdb';

var transactions = new Map<number, fdb.Transaction<fdb.TupleItem[], any>>();

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

export const getFTransaction = () => {
    let id = async_hooks.executionAsyncId();
    let tx = transactions.get(id);
    if (tx) {
        return tx;
    } else {
        return FDBConnection;
    }
};

export function inTx<T>(callback: () => Promise<T>): Promise<T> {
    let id = async_hooks.executionAsyncId();
    let ex = getFTransaction();
    if (ex) {
        return callback();
    }
    return FDBConnection.doTransaction(async (tx) => {
        transactions.set(id, tx);
        return await callback();
    });
}

export function fTx<T>(callback: (tx: Transaction<TupleItem[], any>) => Promise<T>): Promise<T> {
    return FDBConnection.doTransaction(async (tx) => {
        return await callback(tx);
    });
}