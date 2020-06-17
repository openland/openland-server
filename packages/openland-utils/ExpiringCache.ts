export class ExpiringCache<T> {
    private readonly _timeout: number;
    private readonly _cache = new Map<string, {
        value: T | null,
        timer: NodeJS.Timeout | null
    }>();

    constructor(opts?: { timeout?: number }) {
        if (opts && opts.timeout) {
            this._timeout = opts.timeout;
        } else {
            this._timeout = 30 * 1000; // 30 sec
        }
    }

    get(key: string): T | null {
        let res = this._cache.get(key);
        if (res && res.value) {

            // Reset Timer
            clearTimeout(res.timer!);
            res.timer = setTimeout(() => {
                res!.value = null;
                res!.timer = null;
            }, this._timeout);

            return res.value;
        }
        return null;
    }

    save(key: string, value: T) {
        let res = this._cache.get(key);
        if (res) {
            if (!res.value) {
                // If already evicted
                res.value = value;
                res.timer = setTimeout(() => {
                    res!.value = null;
                    res!.timer = null;
                }, this._timeout);
            } else {
                // Reset Timer
                clearTimeout(res.timer!);
                res.value = value;
                res.timer = setTimeout(() => {
                    res!.value = null;
                    res!.timer = null;
                }, this._timeout);
            }
        } else {
            res = {
                value,
                timer: null
            };
            res.timer = setTimeout(() => {
                res!.value = null;
                res!.timer = null;
            }, this._timeout);
            this._cache.set(key, res);
        }
    }
}