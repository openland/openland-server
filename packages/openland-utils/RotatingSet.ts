export class RotatingSet<T> {
    readonly queue: T[] = [];
    readonly data = new Set<T>();
    readonly size: number;

    constructor(size: number) {
        this.size = size;
    }

    add(entry: T) {
        if (this.queue.length === this.size) {
            this.data.delete(this.queue.shift()!);
        }

        this.queue.push(entry);
        this.data.add(entry);
    }

    delete(entry: T) {
        this.queue.splice(this.queue.findIndex(e => e === entry), 1);
        this.data.delete(entry);
    }

    has(entry: T) {
        return this.data.has(entry);
    }
}