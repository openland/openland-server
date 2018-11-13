import { FCacheContext } from './FCacheContext';
import { currentTime } from 'openland-utils/timer';
import { createLogger } from 'openland-log/createLogger';

const log = createLogger('tx-cache');
export async function withCache<T>(callback: () => Promise<T>): Promise<T> {
    let ex = FCacheContext.context.value;
    if (ex) {
        return callback();
    }

    let cache = new FCacheContext();
    let start = currentTime();
    return await FCacheContext.context.withContext(cache, async () => {
        try {
            return await callback();
        } finally {
            log.debug('full read tx time: ' + (currentTime() - start) + ' ms');
        }
    });
}