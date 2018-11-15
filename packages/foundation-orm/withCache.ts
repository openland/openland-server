// import { FCacheContext } from './FCacheContext';
// import { currentTime } from 'openland-utils/timer';
// import { createLogger } from 'openland-log/createLogger';
// import { withLogContext } from 'openland-log/withLogContext';
// import { createEmptyContext } from 'openland-utils/Context';

// const log = createLogger('tx-cache');
export async function withCache<T>(callback: () => Promise<T>): Promise<T> {
    // let ex = FCacheContext.context.value;
    // if (ex) {
    //     return callback();
    // }

    // // let cache = new FCacheContext();
    // // let start = currentTime();
    // // return await FCacheContext.context.withContext(cache, async () => {
    // //     return withLogContext(['cache', cache.id.toString()], async () => {
    // //         try {
    // //             return await callback();
    // //         } finally {
    // //             log.debug(createEmptyContext(), 'full read tx time: ' + (currentTime() - start) + ' ms');
    // //         }
    // //     });
    // // });
    return await callback();
}