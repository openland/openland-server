export class RotatingMap<K, V> {
    private data = new Map<K, V>();
    private queue: K[] = [];
    private size: number;

    constructor(size: number) {
        this.size = size;
    }

    get(key: K): V | undefined {
        return this.data.get(key);
    }

    set(key: K, value: V) {
        if (this.queue.length === this.size) {
            this.data.delete(this.queue.shift()!);
        }
        this.queue.push(key);
        this.data.set(key, value);
    }

    delete(key: K) {
        if (!this.data.has(key)) {
            return;
        }
        this.queue.splice(this.queue.findIndex(k => k === key), 1);
        this.data.delete(key);
    }

    entries() {
        return this.data.entries();
    }

    has(key: K): boolean {
        return this.data.has(key);
    }

    clear() {
        this.data.clear();
        this.queue = [];
    }

    keys() {
        return this.data.keys();
    }
}