import { createIterator } from './asyncIterator';
import { asyncRun } from '../openland-mtproto3/utils';

export function combineAsyncIterators<T>(iterators: AsyncIterable<T>[], onExit: () => void): AsyncIterable<T> {
    let res = createIterator<T>(onExit);

    for (let iterator of iterators) {
        asyncRun(async () => {
            for await (let event of iterator) {
                res.push(event);
            }
        });
    }

    return res;
}