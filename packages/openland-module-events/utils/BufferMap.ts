export class BufferMap<T> {
    private map = new Map<string, T>();

    set(key: Buffer, value: T) {
        this.map.set(key.toString('hex'), value);
    }

    get(key: Buffer) {
        return this.map.get(key.toString('hex'));
    }

    delete(key: Buffer) {
        this.map.delete(key.toString('hex'));
    }

    has(key: Buffer) {
        return this.map.has(key.toString('hex'));
    }

    keys() {
        return [...this.map.keys()].map((v) => Buffer.from(v, 'hex'));
    }

    clear() {
        this.map.clear();
    }
}