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

            let maxDelayRet = minDelay + ((maxDelay - minDelay) / maxFailureCount) * currentFailureCount;
            let waitForRequest = Math.random() * maxDelayRet;
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