export async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function backoff<T>(callback: () => Promise<T>): Promise<T> {
    while (true) {
        try {
            return await callback();
        } catch (_) {
            await delay(1000);
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