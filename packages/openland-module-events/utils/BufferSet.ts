export class BufferSet {
    private set = new Set<string>();

    has(buffer: Buffer) {
        return this.set.has(buffer.toString('hex'));
    }

    add(buffer: Buffer) {
        this.set.add(buffer.toString('hex'));
    }

    delete(buffer: Buffer) {
        this.set.delete(buffer.toString('hex'));
    }

    clear() {
        this.set.clear();
    }
}