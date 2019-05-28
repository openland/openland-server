export class LockOverlord {
    private locked = new Set<string>();
    private queue = new Map<string, (() => void)[]>();

    lock = async <T>(key: string, fn: () => Promise<T>): Promise<T> => {
        if (this.locked.has(key)) {
            await new Promise<void>((resolve) => {
                let ex = this.queue.get(key);
                if (ex) {
                    ex.push(resolve);
                } else {
                    this.queue.set(key, [resolve]);
                }
            });
        }
        if (this.locked.has(key)) {
            throw Error('Internal inconsistency!');
        }
        this.locked.add(key);
        try {
            return await fn();
        } finally {
            setTimeout(() => {
                this.locked.delete(key);
                let ex = this.queue.get(key);
                if (ex) {
                    let cb = ex.shift()!;
                    if (ex.length === 0) {
                        this.queue.delete(key);
                    }
                    cb();
                }
            }, 1);
        }
    }
}