function getNextAsyncIteratorValue<T>(asyncIterator: AsyncIterator<T>, index: number): Promise<{ index: number, iterator: IteratorResult<T> }> {
    return asyncIterator.next().then((iterator: IteratorResult<T>) => {
        return { index, iterator };
    });
}

export async function* combineAsyncIterators<T>(...iterators: AsyncIterator<T>[]): AsyncIterable<T> {
    // Return if iterators is empty (avoid infinite loop).
    if (iterators.length === 0) {
        return;
    }
    const promiseThatNeverResolve = new Promise<any>(() => null);

    try {
        const asyncIteratorsValues = iterators.map(getNextAsyncIteratorValue);
        let numberOfIteratorsAlive = iterators.length;

        do {
            const { iterator, index } = await Promise.race(asyncIteratorsValues);
            if (iterator.done) {
                numberOfIteratorsAlive--;
                // We dont want Promise.race to resolve again on this index
                // so we replace it with a Promise that will never resolve.
                asyncIteratorsValues[index] = promiseThatNeverResolve;
            } else {
                yield iterator.value;
                asyncIteratorsValues[index] = getNextAsyncIteratorValue(iterators[index], index);
            }
        } while (numberOfIteratorsAlive > 0);
    } catch (err) {
        await Promise.all(iterators.map((it) => it.return ? it.return() : null as any));

        throw err;
    }
}