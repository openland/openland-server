import { AsyncLock } from 'openland-utils/timer';

export class KeepAliveService<K, V extends { stop(): Promise<void> | void }> {
    private readonly factory: (key: K) => Promise<V> | V;
    private readonly keepAliveTimers = new Map<K, any>();
    private readonly services = new Map<K, V>();
    private readonly timeout: number;
    private closed = false;
    private readonly lock = new AsyncLock();

    constructor(timeout: number, factory: (key: K) => Promise<V> | V) {
        this.timeout = timeout;
        this.factory = factory;
    }

    getService = async (key: K) => {
        return await this.lock.inLock(async () => {
            if (this.closed) {
                return null;
            }

            // Clear timer
            let timer = this.keepAliveTimers.get(key);
            if (timer) {
                clearTimeout(timer);
            }

            // Create instance
            let service: V;
            if (!this.services.has(key)) {
                service = await this.factory(key);
                if (this.closed) {
                    service.stop();
                    return null;
                }
                this.services.set(key, service);
            } else {
                service = this.services.get(key)!;
            }

            // Register timer
            this.keepAliveTimers.set(key, setTimeout(() => {
                let ex = this.services.get(key);
                if (ex) {
                    this.services.delete(key);
                    ex.stop();
                }
            }, this.timeout));

            return service;
        });
    }

    keepAlive = (key: K) => {
        if (this.closed) {
            return;
        }

        // tslint:disable-next-line:no-floating-promises   
        this.lock.inLock(async () => {
            if (this.closed) {
                return;
            }

            // Clear timer
            let timer = this.keepAliveTimers.get(key);
            if (timer) {
                clearTimeout(timer);
            }

            // Create instance
            if (!this.services.has(key)) {
                let s = await this.factory(key);
                if (this.closed) {
                    s.stop();
                    return;
                }
                this.services.set(key, s);
            }

            // Register timer
            this.keepAliveTimers.set(key, setTimeout(() => {
                let ex = this.services.get(key);
                if (ex) {
                    this.services.delete(key);
                    ex.stop();
                }
            }, this.timeout));
        });
    }

    async close() {
        if (this.closed) {
            return;
        }
        this.closed = true;

        await this.lock.inLock(async () => {
            for (let s of this.keepAliveTimers.values()) {
                clearTimeout(s);
            }
            this.keepAliveTimers.clear();

            for (let s of this.services.values()) {
                await s.stop();
            }
            this.services.clear();
        });
    }
}