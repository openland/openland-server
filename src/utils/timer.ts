import { exponentialBackoffDelay } from './exponentialBackoffDelay';

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

export async function backoff<T>(callback: () => Promise<T>): Promise<T> {
    let currentFailureCount = 0;
    const minDelay = 500;
    const maxDelay = 15000;
    const maxFailureCount = 50;
    while (true) {
        try {
            return await callback();
        } catch (e) {
            if (currentFailureCount < maxFailureCount) {
                currentFailureCount++;
            }
            if (currentFailureCount % 10 === 9) {
                console.warn(e);
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
            if (currentFailureCount < maxFailureCount) {
                currentFailureCount++;
            }
            if (currentFailureCount > maxFailureCount) {
                throw e;
            }
            let waitForRequest = exponentialBackoffDelay(currentFailureCount, minDelay, maxDelay, maxFailureCount);
            await delay(waitForRequest);
        }
    }
}

export async function forever(callback: () => Promise<void>) {
    while (true) {
        await backoff(callback);
    }
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

    private async unlock() {
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
                });
            }
        }
    }
}