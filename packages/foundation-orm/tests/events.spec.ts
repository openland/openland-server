// tslint:disable:no-floating-promises
import * as fdb from 'foundationdb';
import { FConnection } from 'foundation-orm/FConnection';
import { FKeyEncoding } from 'foundation-orm/utils/FKeyEncoding';
import { NativeValue } from 'foundationdb/dist/lib/native';
import { NoOpBus } from './NoOpBus';
import { FEventStore } from 'foundation-orm/FEventStore';
import { inTx } from 'foundation-orm/inTx';
import { createNamedContext } from '@openland/context';

describe('events', () => {
    let db: fdb.Database<NativeValue, any>;
    beforeAll(async () => {
        db = FConnection.create()
            .at(FKeyEncoding.encodeKey(['_tests_events']));
        await db.clearRange(FKeyEncoding.encodeKey([]));
    });

    it('should create singe events', async () => {
        let connection = new FConnection(db, NoOpBus, true);
        await connection.ready(createNamedContext('test'));
        let factory = new FEventStore('test1', connection);
        await inTx(createNamedContext('test'), async (ctx) => {
            await factory.create(ctx, [1], { event: 1 });
        });
        await inTx(createNamedContext('test'), async (ctx) => {
            await factory.create(ctx, [1], { event: 2 });
        });
        await inTx(createNamedContext('test'), async (ctx) => {
            await factory.create(ctx, [1], { event: 2 });
        });
        await inTx(createNamedContext('test'), async (ctx) => {
            await factory.create(ctx, [1], { event: 3 });
        });

        let events = await factory.findAll(createNamedContext('test'), [1]);
        expect(events.length).toBe(4);
        expect(events[0].value.event).toBe(1);
        expect(events[1].value.event).toBe(2);
        expect(events[2].value.event).toBe(2);
        expect(events[3].value.event).toBe(3);
    });

    it('should create multiple events', async () => {
        let connection = new FConnection(db, NoOpBus, true);
        await connection.ready(createNamedContext('test'));
        let factory = new FEventStore('test2', connection);
        await inTx(createNamedContext('test'), async (ctx) => {
            await factory.create(ctx, [1], { event: 1 });
            await factory.create(ctx, [1], { event: 2 });
            await factory.create(ctx, [1], { event: 2 });
            await factory.create(ctx, [1], { event: 3 });
        });

        let events = await factory.findAll(createNamedContext('test'), [1]);
        expect(events.length).toBe(4);
        expect(events[0].value.event).toBe(1);
        expect(events[1].value.event).toBe(2);
        expect(events[2].value.event).toBe(2);
        expect(events[3].value.event).toBe(3);
    });

    it('range should work', async () => {
        let connection = new FConnection(db, NoOpBus, true);
        await connection.ready(createNamedContext('test'));
        let factory = new FEventStore('test3', connection);
        await inTx(createNamedContext('test'), async (ctx) => {
            await factory.create(ctx, [1], { event: 1 });
            await factory.create(ctx, [1], { event: 2 });
            await factory.create(ctx, [1], { event: 2 });
            await factory.create(ctx, [1], { event: 3 });
        });

        let events = await factory.range(createNamedContext('test'), [1], { limit: 1 });
        expect(events.length).toBe(1);
        expect(events[0].value.event).toBe(1);

        events = await factory.range(createNamedContext('test'), [1], { limit: 2, after: events[0].key });
        expect(events.length).toBe(2);
        expect(events[0].value.event).toBe(2);
        expect(events[1].value.event).toBe(2);

        events = await factory.range(createNamedContext('test'), [1], { limit: 2, after: events[1].key });
        expect(events.length).toBe(1);
        expect(events[0].value.event).toBe(3);

        events = await factory.range(createNamedContext('test'), [1], { limit: 2, after: events[0].key });
        expect(events.length).toBe(0);
    });
});