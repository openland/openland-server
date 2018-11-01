import Decimal from 'decimal.js';

export type FID = symbol;

export function unpackFID(value: number | Decimal | string): FID {
    let src: Decimal;
    if (typeof value === 'number') {
        src = new Decimal(value);
    } else if (typeof value === 'string') {
        src = new Decimal('0x' + value);
    } else {
        src = value;
    }
    let hv = src.toHex().substring(2);
    if (hv.length % 2 !== 0) {
        hv = '0' + hv;
    }
    return Symbol.for('fid-' + hv);
}

export function packKeyFID(src: FID) {
    let key = Symbol.keyFor(src);
    if (!key) {
        throw Error('No key!');
    }
    if (!key.startsWith('fid-')) {
        throw Error('Invalid symbol');
    }
    let hex = key.substr(4);
    let res = new Decimal('0x' + hex);
    let n = res.toNumber();
    if (Number.isSafeInteger(n)) {
        return n;
    } else {
        return res;
    }
}

export function packFID(src: FID) {
    let key = Symbol.keyFor(src);
    if (!key) {
        throw Error('No key!');
    }
    if (!key.startsWith('fid-')) {
        throw Error('Invalid symbol');
    }
    let hex = key.substr(4);
    new Decimal('0x' + hex);
    return hex;
}