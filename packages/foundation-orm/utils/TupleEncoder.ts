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
    UUID = 0x30,
}

const numByteLen = (num: number) => {
    let max = 1;
    for (let i = 0; i <= 8; i++) {
        if (num < max) { return i; }
        max *= 256;
    }
    throw Error('Number too big for encoding');
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
        if (Number.isSafeInteger(item) && !Object.is(item, -0) && item >= 0) {
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
            throw Error('Key encoder doesn\'t support non-integer or negative numbers, got: ' + item);
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

export function pack(key: FKeyItem[]) {
    let builder = new BufferBuilder();
    for (let i = 0; i < key.length; i++) {
        encode(builder, key[i]);
    }
    return builder.make();
}