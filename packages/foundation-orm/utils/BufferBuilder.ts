export class BufferBuilder {
    
    storage: Buffer;
    used: number = 0;

    constructor(capacity: number = 64) {
        this.storage = Buffer.alloc(capacity);
    }

    make() {
        const result = Buffer.alloc(this.used);
        this.storage.copy(result, 0, 0, this.used);
        return result;
    }

    need(numBytes: number) {
        if (this.storage.length < this.used + numBytes) {
            let newAmt = this.storage.length;
            while (newAmt < this.used + numBytes) {
                newAmt *= 2;
            }
            const newStorage = Buffer.alloc(newAmt);
            this.storage.copy(newStorage);
            this.storage = newStorage;
        }
    }

    appendByte(val: number) {
        this.need(1); this.storage[this.used++] = val;
    }

    appendString(val: string) {
        const len = Buffer.byteLength(val);
        this.need(len);
        this.storage.write(val, this.used);
        this.used += len;
    }

    appendBuffer(val: Buffer) {
        this.need(val.length);
        val.copy(this.storage, this.used);
        this.used += val.length;
    }
}