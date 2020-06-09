import {
    schema, string, integer, boolean, struct, date, nullable, TypeFromSchema, union,
} from '.';
import { Table } from './Table';
import DatabaseClient from '../DatabaseClient';
import { TableClient } from '../TableClient';
import { createNamedContext } from '@openland/context';
jest.mock('../DatabaseClient');

beforeEach(() => {
    // Clear all instances and calls to constructor and all methods:
    jest.clearAllMocks();
});

it('should-create-correctly', async () => {
    let s = schema({
        kek: string(),
        lol: nullable(integer()),
        bool: boolean(),
        date: nullable(date()),
        nested: struct({
            kek: string()
        }),
        union: union({
            flex: {
                kex: string(),
            },
            lol: {
                orbidol: integer()
            }
        })
    });
    expect(s.fields).toEqual([
        { name: 'kek', field: { type: 'string', dbType: 'String' } },
        {
            name: 'lol',
            field: { type: 'number', dbType: 'Int64', nullable: true }
        },
        { name: 'bool', field: { type: 'boolean', dbType: 'UInt8' } },
        {
            name: 'date',
            field: { type: 'date', dbType: 'DateTime', nullable: true }
        },
        { name: 'nested.kek', field: { type: 'string', dbType: 'String' } },
        { name: 'union.type', field: { type: 'string', dbType: 'String' } },
        {
            name: 'union.flex.kex',
            field: { type: 'string', dbType: 'String', nullable: true }
        },
        {
            name: 'union.lol.orbidol',
            field: { type: 'number', dbType: 'Int64', nullable: true }
        }
    ]);
});

it('should-map-objects-correctly', async () => {
    let s = schema({
        kek: string(),
        lol: nullable(integer()),
        bool: boolean(),
        date: nullable(date()),
        nested: struct({
            kek: string()
        }),
        nullableStruct: struct({
            flex: nullable(string())
        }),
        union: union({
            kek: {
                flex: string()
            },
            lol: {
                orbidol: integer(),
            }
        })
    });

    let obj: TypeFromSchema<typeof s> = {
        nested: {
            kek: '12'
        },
        lol: null,
        kek: 'lol',
        bool: false,
        date: 1590515472000,
        nullableStruct: {
            flex: null
        },
        union: {
            type: 'kek',
            flex: '123'
        }
    };
    let values = s.mapToDb(obj);

    let expectedValues = ['lol', null, 0, 1590515472, '12', null, 'kek', '123', null];
    expect(values).toEqual(expectedValues);

    let obj2 = s.mapFromDb(values);
    expect(obj2).toMatchObject(obj);
});

it('should-generate-table-schema', async () => {
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
    let table = new Table('test', s, { id: 'id', orderBy: 'id', partition: 'id' });
    let dbClient = new DatabaseClient({} as any, 'kek');
    let tableClient = new TableClient(dbClient, table);

    await tableClient.createTable(ctx);
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
    }, { name: 'operation.purchase.id', type: 'Nullable(String)' }], 'id', 'id', 'id']);
});