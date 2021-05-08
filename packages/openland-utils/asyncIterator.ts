import { Observable } from 'rxjs';

export type PushableIterator<T> = AsyncIterable<T> & {
    onExit: (() => void) | undefined,
    push(data: T): void,
    complete(): void
};

export function createIterator<T>(onExit?: () => void): PushableIterator<T> {
    let events: (T | null)[] = [];
    let resolvers: any[] = [];
    let callback: (() => void) | undefined = onExit;

    const getValue = () => {
        return new Promise<IteratorResult<T>>((resolve => {
            if (events.length > 0) {
                let val = events.shift();

                if (val === null) {
                    resolve({ value: undefined, done: true } as any);
                } else {
                    resolve({ value: val!, done: false });
                }
            } else {
                resolvers.push(resolve);
            }
        }));
    };

    let onReturn = () => {
        events = [];
        resolvers = [];
        if (callback) {
            callback();
        }
        return Promise.resolve({ value: undefined, done: true } as any);
    };

    return {
        set onExit(v: (() => void) | undefined) {
            callback = v;
        },
        get onExit() {
            return callback;
        },
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
            if (data === null) {
                throw Error('data could not be null'); // Used as completion thombstone
            }
            if (resolvers.length > 0) {
                resolvers.shift()({
                    value: data,
                    done: false
                });
            } else {
                events.push(data);
            }
        },
        complete() {
            if (resolvers.length > 0) {
                resolvers.shift()({
                    value: null,
                    done: true
                });
            } else {
                events.push(null);
            }
        }
    };
}

export function createIteratorFromObservable<T>(observable: Observable<T>, onError: (err: any) => void): AsyncIterable<T> {
    let iterator = createIterator<T>(() => {
        // do nothing
    });
    observable.subscribe({
        next: (value) => {
            iterator.push(value);
        },
        complete: () => {
            iterator.complete();
        },
        error: (err) => {
            onError(err);
            iterator.complete();
        }
    });
    return iterator;
}