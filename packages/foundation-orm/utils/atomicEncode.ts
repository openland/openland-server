export function encodeAtomic(value: number) {
    const b = Buffer.alloc(4);
    b.writeInt32LE(value, 0);
    return b;
}

export function decodeAtomic(src: Buffer): number {
    return src.readInt32LE(0);
}