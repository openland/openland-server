const INT32_BYTES = 32 / 8;

export class BufferWriter {
    private _storage: Buffer;
    private _used: number = 0;

    constructor(capacity: number = 64) {
        this._storage = Buffer.alloc(capacity);
    }

    writeUInt32LE(val: number) {
        this._need(INT32_BYTES);
        this._storage.writeUInt32LE(val, this._used);
        this._used += INT32_BYTES;
    }

    writeBuffer(val: Buffer) {
        this._need(val.length);
        val.copy(this._storage, this._used);
        this._used += val.length;
    }

    writeUInt32LEVector(values: number[]) {
        this._need(values.length * INT32_BYTES + 1);
        this.writeUInt32LE(values.length);
        for (let val of values) {
            this.writeUInt32LE(val);
        }
    }

    build() {
        const result = Buffer.alloc(this._used);
        this._storage.copy(result, 0, 0, this._used);
        return result;
    }

    private _need(numBytes: number) {
        if (this._storage.length < this._used + numBytes) {
            let newAmt = this._storage.length;
            while (newAmt < this._used + numBytes) {
                newAmt *= 2;
            }
            const newStorage = Buffer.alloc(newAmt);
            this._storage.copy(newStorage);
            this._storage = newStorage;
        }
    }
}

export class BufferReader {
    readonly bufffer: Buffer;
    offset: number = 0;

    constructor(src: Buffer) {
        this.bufffer = src;
    }

    get completed() {
        return this.offset >= this.bufffer.length;
    }

    readUInt32LE() {
        let val = this.bufffer.readUInt32LE(this.offset);
        this.offset += INT32_BYTES;
        return val;
    }

    readUInt32Vector() {
        let res: number[] = [];
        let len = this.readUInt32LE();
        for (let i = 0; i < len; i++) {
            res.push(this.readUInt32LE());
        }
        return res;
    }
}