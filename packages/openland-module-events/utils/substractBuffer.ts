export function subsctractBuffer(src: Buffer, sub: Buffer): Buffer {
    if (src.length !== sub.length) {
        throw Error('Buffers have different sizes');
    }

    // Ignore for empty
    if (src.length === 0) {
        return src;
    }

    let overflow = 0;
    let res: number[] = [];
    for (let i = src.length - 1; i >= 0; i--) {
        let a = src.readInt8(i);
        let b = sub.readInt8(i) + overflow;
        if (b > a) {
            overflow = 1;
            res.unshift(255 + a - b);
        } else {
            overflow = 0;
            res.unshift(a - b);
        }
    }

    return Buffer.from(res);
}