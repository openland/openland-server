import { Decimal } from 'decimal.js';
import { BufferBuilder } from './BufferBuilder';

// const nullByte = Buffer.from('00', 'hex');
// const falseByte = Buffer.from('26', 'hex');
// const trueByte = Buffer.from('27', 'hex');

export type FKeyItem = string | number | boolean | null | Decimal;

enum Code {
    Null = 0,
    False = 0x26,
    True = 0x27,
    String = 2,
    IntZero = 0x14,
    Double = 0x21,
}

const numByteLen = (num: number) => {
    let max = 1;
    for (let i = 0; i <= 8; i++) {
        if (num < max) { return i; }
        max *= 256;
    }
    throw Error('Number too big for encoding');
};

const adjustFloat = (data: Buffer, isEncode: boolean) => {
    if ((isEncode && (data[0] & 0x80) === 0x80) || (!isEncode && (data[0] & 0x80) === 0x00)) {
        for (var i = 0; i < data.length; i++) {
            data[i] = ~data[i];
        }
    } else {
        data[0] ^= 0x80;
    }
    return data;
};

export function encode(into: BufferBuilder, item: FKeyItem) {
    if (item === undefined) {
        throw new TypeError('Packed element cannot be undefined');
    } else if (item === null) {
        into.appendByte(Code.Null);
    } else if (item === false) {
        into.appendByte(Code.False);
    } else if (item === true) {
        into.appendByte(Code.True);
    } else if (typeof item === 'string') {
        let itemBuf: Buffer;
        itemBuf = Buffer.from(item, 'utf8');
        into.appendByte(Code.String);
        for (let i = 0; i < itemBuf.length; i++) {
            const val = itemBuf.readUInt8(i);
            into.appendByte(val);
            if (val === 0) {
                into.appendByte(0xff);
            }
        }
        into.appendByte(0);
    } else if (typeof item === 'number') {
        if (Number.isSafeInteger(item) && !Object.is(item, -0)) {
            if (item < 0) {
                throw Error('Key encoder doesn\'t support negative integers, got: ' + item);
            }

            let byteLen = numByteLen(item);
            into.need(1 + byteLen);

            // Write bytes length
            into.appendByte(Code.IntZero + byteLen);

            // Append value
            let lowBits = (item & 0xffffffff) >>> 0;
            let highBits = ((item - lowBits) / 0x100000000) >>> 0;
            for (; byteLen > 4; --byteLen) {
                into.appendByte(highBits >>> (8 * (byteLen - 5)));
            }
            for (; byteLen > 0; --byteLen) {
                into.appendByte(lowBits >>> (8 * (byteLen - 1)));
            }
        } else {

            // Double precision float.
            into.appendByte(Code.Double);

            // We need to look at the representation bytes - which needs a temporary buffer.
            const bytes = Buffer.allocUnsafe(8);
            bytes.writeDoubleBE(item, 0);
            adjustFloat(bytes, true);
            into.appendBuffer(bytes);
        }
    } else if (item instanceof Decimal) {
        if (!item.isInteger() || item.lessThan(0)) {
            throw Error('Key encoder doesn\'t support non-integer or negative numbers');
        }
        let hex = item.toHex().substring(2);
        if (hex.length % 2 !== 0) {
            hex = '0' + hex;
        }
        let byteLen = hex.length / 2;
        if (byteLen > 8) {
            throw Error('Too large decimal');
        }
        into.need(1 + byteLen);

        // Write bytes length
        into.appendByte(Code.IntZero + byteLen);

        // Write body
        for (let i = 0; i < byteLen; i++) {
            let v = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
            into.appendByte(v & 0xFF);
        }
    } else {
        throw Error('Unsupported type');
    }
}

function decodeNumber(buf: Buffer, offset: number, numBytes: number) {
    numBytes = Math.abs(numBytes);

    let numDec = new Decimal(0);
    let multDec = new Decimal(1);
    let num = 0;
    let mult = 1;
    for (let i = numBytes - 1; i >= 0; --i) {
        let b = buf[offset + i];
        num += b * mult;
        numDec = numDec.add(multDec.mul(b));
        mult *= 0x100;
        multDec = multDec.mul(0x100);
    }

    if (!Number.isSafeInteger(num)) {
        return numDec;
    }

    return num;
}

export function decode(buf: Buffer, pos: { p: number }) {
    const code = buf.readUInt8(pos.p++) as Code;
    let p = pos.p;
    switch (code) {
        case Code.Null: return null;
        case Code.False: return false;
        case Code.True: return true;
        case Code.String: {
            const builder = new BufferBuilder();
            for (; p < buf.length; p++) {
                const byte = buf[p];
                if (byte === 0) {
                    if (p + 1 >= buf.length || buf[p + 1] !== 0xff) {
                        break;
                    } else {
                        p++; // skip 0xff.
                    }
                }
                builder.appendByte(byte);
            }
            pos.p = p + 1; // eat trailing 0
            return builder.make().toString();
        }
        case Code.Double: {
            const numBuf = Buffer.alloc(8);
            buf.copy(numBuf, 0, p, p + 8);
            adjustFloat(numBuf, false);
            pos.p += 8;
            return numBuf.readDoubleBE(0);
        }
        default: {
            const byteLen = code - 20; // negative if number is negative.
            if (byteLen < 0) {
                throw Error('Negative values are not supported');
            }
            const absByteLen = Math.abs(byteLen);
            if (absByteLen <= 8) {
                pos.p += absByteLen;
                return code === Code.IntZero ? 0 : decodeNumber(buf, p, byteLen);
            } else {
                throw new TypeError(`Unknown data type in DB: ${buf} at ${pos} code ${code}`);
            }
        }
    }
}

export function pack(key: FKeyItem[]) {
    let builder = new BufferBuilder();
    for (let i = 0; i < key.length; i++) {
        encode(builder, key[i]);
    }
    return builder.make();
}

export function unpack(key: Buffer) {
    const pos = { p: 0 };
    const arr = [];

    while (pos.p < key.length) {
        arr.push(decode(key, pos));
    }

    return arr;
}