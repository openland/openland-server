import { exponentialBackoffDelay } from './exponentialBackoffDelay';
import { createLogger } from 'openland-log/createLogger';

export function delayBreakable(ms: number) {
    // We can cancel delay from outer code
    let promiseResolver: ((value?: any | PromiseLike<any>) => void) | null = null;
    let resolver = () => {
        if (promiseResolver) {
            promiseResolver();
        }
    };
    let promise = new Promise(resolve => {
        promiseResolver = resolve;
        setTimeout(resolve, ms);
    });
    return { promise, resolver };
}

export async function delay(ms: number) {
    return new Promise(resolve => { setTimeout(resolve, ms); });
}

export function debouncer(ms: number) {
    let locks: Map<number, boolean> = new Map();

    return (tag: number, cb: () => {}) => {
        if (locks.has(tag)) {
            return;
        } else {
            cb();
            locks.set(tag, true);

            setTimeout(() => {
                locks.delete(tag);
            }, ms);
        }
    };
}

export function debounce(ms: number, func: (...args: any[]) => any) {
    let lock = false;

    return (...args2: any[]) => {
        if (lock) {
            return;
        }

        lock = true;
        setTimeout(() => {
            lock = false;
        }, ms);
        return func(...args2);
    };
}

const log = createLogger('backoff');

export async function backoff<T>(callback: () => Promise<T>): Promise<T> {
    let currentFailureCount = 0;
    const minDelay = 500;
    const maxDelay = 15000;
    const maxFailureCount = 50;
    while (true) {
        try {
            return await callback();
        } catch (e) {
            log.warn(e);
            if (currentFailureCount < maxFailureCount) {
                currentFailureCount++;
            }

            let waitForRequest = exponentialBackoffDelay(currentFailureCount, minDelay, maxDelay, maxFailureCount);
            await delay(waitForRequest);
        }
    }
}

export async function retry<T>(callback: () => Promise<T>): Promise<T> {
    let currentFailureCount = 0;
    const minDelay = 500;
    const maxDelay = 15000;
    const maxFailureCount = 5;
    while (true) {
        try {
            return await callback();
        } catch (e) {
            currentFailureCount++;
            if (currentFailureCount > maxFailureCount) {
                throw e;
            }
            let waitForRequest = exponentialBackoffDelay(currentFailureCount, minDelay, maxDelay, maxFailureCount);
            await delay(waitForRequest);
        }
    }
}

export function forever(callback: () => Promise<void>) {
    // tslint:disable-next-line:no-floating-promises
    (async () => {
        while (true) {
            await backoff(callback);
        }
    })();
}

export function foreverBreakable(callback: () => Promise<void>) {
    let working = true;
    // tslint:disable-next-line:no-floating-promises
    let promise = (async () => {
        while (working) {
            await backoff(callback);
        }
    })();

    return {
        stop: async () => {
            working = false;
            await promise;
        }
    };
}

export function currentTime(): number {
    return new Date().getTime();
}

export function printElapsed(tag: string, src: number) {
    let time = currentTime();
    console.warn(`${tag} in ${time - src} ms`);
    return time;
}

export class AsyncLock {
    private permits: number = 1;
    private promiseResolverQueue: Array<(v: boolean) => void> = [];

    async inLock<T>(func: () => Promise<T> | T): Promise<T> {
        try {
            await this.lock();
            return await func();
        } finally {
            this.unlock();
        }
    }

    private async lock() {
        if (this.permits > 0) {
            this.permits = this.permits - 1;
            return;
        }
        await new Promise<boolean>(resolve => this.promiseResolverQueue.push(resolve));
    }

    private unlock() {
        this.permits += 1;
        if (this.permits > 1 && this.promiseResolverQueue.length > 0) {
            throw new Error('this.permits should never be > 0 when there is someone waiting.');
        } else if (this.permits === 1 && this.promiseResolverQueue.length > 0) {
            // If there is someone else waiting, immediately consume the permit that was released
            // at the beginning of this function and let the waiting function resume.
            this.permits -= 1;

            const nextResolver = this.promiseResolverQueue.shift();
            // Resolve on the next tick
            if (nextResolver) {
                setTimeout(() => {
                    nextResolver(true);
                }, 0);
            }
        }
    }
}