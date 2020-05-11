import { RandomLayer } from '@openland/foundationdb-random';
import { Store } from 'openland-module-db/FDB';
import { Context } from '@openland/context';
import { createLogger } from '@openland/log';

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