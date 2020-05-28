import { RandomLayer } from '@openland/foundationdb-random';
import { Store } from 'openland-module-db/FDB';
import { Context } from '@openland/context';
import { createLogger } from '@openland/log';
import {
    date, Schema, SchemaBuilder, SchemaShape, ShapeToSchema, string, TypeFromSchema,
} from '../openland-module-clickhouse/schema';
import { table } from '../openland-module-clickhouse/schema/Table';
import { TableSpace } from '../openland-module-clickhouse/TableSpace';
import { HyperLogEvent } from '../openland-module-db/store';

const logger = createLogger('hyperlog');

export type HyperEvent<T> = {
    type: string;
    event(ctx: Context, event: T): void
};

export function createHyperlogger<T>(type: string): HyperEvent<T> {
    return {
        type,
        event: (ctx: Context, event: T) => {
            try {
                Store.HyperLog.create_UNSAFE(ctx, Store.storage.db.get(RandomLayer).nextRandomId(), {
                    type: type,
                    date: Date.now(),
                    body: event
                });
            } catch (e) {
                logger.warn(ctx, e);
            }
        }
    };
}

export function createModernHyperlogger<T extends SchemaShape>(type: string, chSchema: T, partition?: string, orderBy?: string): HyperEvent<TypeFromSchema<Schema<ShapeToSchema<T>>>> {
    // add default hyperlog fields
    let builder = SchemaBuilder.fromShape(chSchema);
    builder.field('id', string());
    builder.field('date', date());

    // build and register table
    let chTable = table(type, builder.build(), 'id', partition || 'toYYYYMM(date)',  orderBy || '(id, date)');
    TableSpace.add(chTable);

    return {
        type,
        event: (ctx: Context, event: T) => {
            try {
                Store.HyperLogStore.post(ctx, HyperLogEvent.create({
                    id: Store.storage.db.get(RandomLayer).nextRandomId(),
                    eventType: type,
                    date: Date.now(),
                    body: event
                }));
            } catch (e) {
                logger.warn(ctx, e);
            }
        }
    };
}