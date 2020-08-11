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

    keepAlive = (key: K) => {
        if (this.closed) {
            return;
        }
        
        // tslint:disable-next-line:no-floating-promises        
        this.lock.inLock(async () => {

            // Clear timer
            let timer = this.keepAliveTimers.get(key);
            if (timer) {
                clearTimeout(timer);
            }

            // Create instance
            if (!this.services.has(key)) {
                let s = await this.factory(key);
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