import { FDB } from 'openland-module-db/FDB';
import { inTxLeaky } from 'foundation-orm/inTx';
import { Context } from '@openland/context';
import { createLogger } from '@openland/log';

const logger = createLogger('hyperlog');

export function createHyperlogger<T>(type: string) {
    return {
        event: async (parent: Context, event: T) => {
            try {
                await inTxLeaky(parent, async (ctx) => {
                    await FDB.HyperLog.create_UNSAFE(ctx, FDB.layer.db.nextRandomId(), {
                        type: type,
                        date: Date.now(),
                        body: event
                    });
                });
            } catch (e) {
                logger.warn(parent, e);
            }
        }
    };
}