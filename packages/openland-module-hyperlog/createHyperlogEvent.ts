import { FDB } from 'openland-module-db/FDB';

export function createHyperlogger<T>(type: string) {
    return {
        event: async (event: T) => {
            await FDB.HyperLog.create(await FDB.HyperLog.connection.nextRandomId(), {
                type: type,
                date: Date.now(),
                body: event
            });
        }
    };
}