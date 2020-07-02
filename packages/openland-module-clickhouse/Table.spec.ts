import { integer, schema, string, union } from './schema';
import { createNamedContext } from '@openland/context';
import DatabaseClient from './DatabaseClient';
import { table, TableSpace } from './TableSpace';
jest.mock('./DatabaseClient');

beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    jest.clearAllMocks();
});

it('should-create-table', async () => {
    let s = schema({
        id: string(), type: string(), // payment_success, payment_failing, payment_action_needed, payment_canceled
        uid: integer(), amount: integer(), pid: string(), operation: union({
            deposit: {
                uid: integer(), txid: string()
            }, subscription: {
                uid: integer(), subscription: string(), period: integer(), txid: string(),
            }, transfer: {
                fromUid: integer(), fromTx: string(), toUid: integer(), toTx: string()
            }, purchase: {
                id: string(),
            }
        })
    });
    let ctx = createNamedContext('mock');
    let t = table('test', s, { primaryKey: 'id', orderBy: 'id', partition: 'id' });
    let dbClient = new DatabaseClient({} as any, 'kek');

    await t.createTable(ctx, dbClient);
    expect(jest.spyOn(dbClient, 'createTable').mock.calls[0]).toEqual([ctx, 'test', [{
        name: 'id',
        type: 'String'
    }, { name: 'type', type: 'String' }, { name: 'uid', type: 'Int64' }, {
        name: 'amount',
        type: 'Int64'
    }, { name: 'pid', type: 'String' }, { name: 'operation.type', type: 'String' }, {
        name: 'operation.deposit.uid',
        type: 'Nullable(Int64)'
    }, { name: 'operation.deposit.txid', type: 'Nullable(String)' }, {
        name: 'operation.subscription.uid',
        type: 'Nullable(Int64)'
    }, {
        name: 'operation.subscription.subscription', type: 'Nullable(String)'
    }, { name: 'operation.subscription.period', type: 'Nullable(Int64)' }, {
        name: 'operation.subscription.txid',
        type: 'Nullable(String)'
    }, { name: 'operation.transfer.fromUid', type: 'Nullable(Int64)' }, {
        name: 'operation.transfer.fromTx',
        type: 'Nullable(String)'
    }, { name: 'operation.transfer.toUid', type: 'Nullable(Int64)' }, {
        name: 'operation.transfer.toTx',
        type: 'Nullable(String)'
    }, { name: 'operation.purchase.id', type: 'Nullable(String)' }], 'id', 'id', 'id', undefined]);
});

it('should-lock-table-space', async () => {
    let s = schema({
        id: string(), type: string(), // payment_success, payment_failing, payment_action_needed, payment_canceled
        uid: integer(), amount: integer(), pid: string(), operation: union({
            deposit: {
                uid: integer(), txid: string()
            }, subscription: {
                uid: integer(), subscription: string(), period: integer(), txid: string(),
            }, transfer: {
                fromUid: integer(), fromTx: string(), toUid: integer(), toTx: string()
            }, purchase: {
                id: string(),
            }
        })
    });

    TableSpace.lock();
    expect(() => {
        table('test', s, { primaryKey: 'id', orderBy: 'id', partition: 'id' });
    }).toThrow('TableSpace is locked');
});