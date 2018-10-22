export function createIterator<T>(onExit: () => void): AsyncIterable<T> & { push(data: T): void } {
    let events: T[] = [];
    let resolvers: any[] = [];

    const getValue = () => {
        return new Promise<IteratorResult<T>>((resolve => {
            if (events.length > 0) {
                let val = events.shift();

                resolve({ value: val!, done: false})
            } else {
                resolvers.push(resolve);
            }
        }));
    };

    let onReturn = () => {
        events = [];
        resolvers = [];
        onExit();
        return Promise.resolve({ value: undefined, done: true } as any);
    };

    return {
        [Symbol.asyncIterator]() {
            return {
                next(): Promise<IteratorResult<T>> {
                    return getValue();
                },
                return: onReturn,
                throw(error: any) {
                    return Promise.reject(error);
                }
            };
        },
        push(data: T) {
            if (resolvers.length > 0) {
                resolvers.shift()({
                    value: data,
                    done: false
                });
            } else {
                events.push(data);
            }
        }
    };
}