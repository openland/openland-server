import { FDB } from 'openland-module-db/FDB';
import { inTx } from 'foundation-orm/inTx';

export function createHyperlogger<T>(type: string) {
    return {
        event: async (event: T) => {
            try {
                await inTx(async () => {
                    await FDB.HyperLog.create(await FDB.HyperLog.connection.nextRandomId(), {
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