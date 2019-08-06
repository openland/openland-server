import { RandomLayer } from '@openland/foundationdb-random';
import { Store } from 'openland-module-db/FDB';
import { Context } from '@openland/context';
import { createLogger } from '@openland/log';

const logger = createLogger('hyperlog');

export function createHyperlogger<T>(type: string) {
    return {
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