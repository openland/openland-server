import { exponentialBackoffDelay } from './exponentialBackoffDelay';
import { createLogger } from '@openland/log';
import { Context } from '@openland/context';

// import { createLogger } from 'openland-log/createLogger';

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
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
}

export async function delayRandomized(from: number, to: number) {
    return new Promise(resolve => {
        setTimeout(resolve, Math.floor(from + Math.random() * (to - from)));
    });
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
    let timer: NodeJS.Timeout | null = null;
    return (...args: any[]) => {
        if (timer) {
            clearTimeout(timer);
        }
        timer = setTimeout(() => {
            func(args);
            timer = null;
        }, ms);
    };
}

export function throttle<T extends any[]>(ms: number, func: (...args: T) => void) {
    let lock = false;
    let lastArgs: T | null = null;

    return (...args2: T) => {
        if (lock) {
            lastArgs = args2;
            return;
        }

        lock = true;
        lastArgs = null;
        setTimeout(() => {
            lock = false;
            if (lastArgs) {
                func(...lastArgs);
                lastArgs = null;
            }
        }, ms);
        func(...args2);
    };
}

const log = createLogger('backoff');

export async function backoff<T>(ctx: Context, callback: () => Promise<T>): Promise<T> {
    let currentFailureCount = 0;
    const minDelay = 500;
    const maxDelay = 15000;
    const maxFailureCount = 50;
    while (true) {
        try {
            return await callback();
        } catch (e) {
            if (currentFailureCount > 3) {
                log.warn(ctx, e);
            }
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

export function forever(ctx: Context, callback: () => Promise<void>) {
    // tslint:disable-next-line:no-floating-promises
    (async () => {
        while (true) {
            await backoff(ctx, callback);
        }
    })();
}

export function foreverBreakable(ctx: Context, callback: () => Promise<void>) {
    let working = true;
    // tslint:disable-next-line:no-floating-promises
    let promise = (async () => {
        while (working) {
            await backoff(ctx, callback);
        }
    })();

    return {
        stop: async () => {
            working = false;
            await promise;
        }
    };
}

export function currentRunningTime() {
    let t = process.hrtime();
    return ((t[0] * 1e9) + t[1]) / 1000000;
}

export function currentTime(): number {
    return new Date().getTime();
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

export const ddMMYYYYFormat = (date: Date) =>
    ('00' + date.getDate()).slice(-2) + '/' +
    ('00' + (date.getMonth() + 1)).slice(-2) + '/' +
    date.getFullYear() + ' ' +
    ('00' + date.getHours()).slice(-2) + ':' +
    ('00' + date.getMinutes()).slice(-2) + ':' +
    ('00' + date.getSeconds()).slice(-2);

export const asyncRun = (handler: () => Promise<any>) => {
    // tslint:disable-next-line:no-floating-promises
    handler();
};