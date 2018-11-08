import { FCacheContext } from './FCacheContext';

export async function withCache<T>(callback: () => Promise<T>): Promise<T> {
    let ex = FCacheContext.context.value;
    if (ex) {
        return callback();
    }

    let cache = new FCacheContext();
    return await FCacheContext.context.withContext(cache, async () => {
        return await callback();
    });
}