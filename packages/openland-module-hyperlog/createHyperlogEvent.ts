import { FDB } from 'openland-module-db/FDB';
import { inTx } from 'foundation-orm/inTx';
import { Context } from 'openland-utils/Context';

export function createHyperlogger<T>(type: string) {
    return {
        event: async (parent: Context, event: T) => {
            try {
                await inTx(parent, async (ctx) => {
                    await FDB.HyperLog.create_UNSAFE(ctx, await FDB.HyperLog.connection.nextRandomId(), {
                        type: type,
                        date: Date.now(),
                        body: event
                    });
                });
            } catch (e) {
                console.warn(e);
            }
        }
    };
}