import { sortedArrayAdd } from '../../../utils/sortedArrayAdd';

export function isWithin(cursor: { from?: number | null, to?: number | null }, key: number) {
    if ((cursor.to !== null && cursor.to !== undefined) && (cursor.to < key)) {
        return false;
    }
    if ((cursor.from !== null && cursor.from !== undefined) && (key < cursor.from)) {
        return false;
    }
    return true;
}

export function isIntervalWithin(cursor: { from?: number | null, to?: number | null }, interval: { min: number, max: number }) {
    if (cursor.from !== null && cursor.from !== undefined) {
        if (interval.min < cursor.from) {
            return false;
        }
    }
    if (cursor.to !== null && cursor.to !== undefined) {
        if (cursor.to < interval.max) {
            return false;
        }
    }
    return true;
}

export function isIntersects(cursor: { from?: number | null, to?: number | null }, interval: { min: number, max: number }) {
    let from = cursor.from || Number.MIN_SAFE_INTEGER;
    let to = cursor.to || Number.MAX_SAFE_INTEGER;
    if (from > interval.max) {
        return false;
    }
    if (interval.min > to) {
        return false;
    }
    return true;
}

const recordCompare = (a: number, b: number) => a - b;
const childrenCompare = (a: { id: number, min: number, max: number, count: number }, b: { id: number, min: number, max: number, count: number }) => a.min - b.min;

export function recordAdd(records: number[], value: number) {
    return sortedArrayAdd(records, value, recordCompare);
}

export function childrenAdd(records: { id: number, min: number, max: number, count: number }[], value: { id: number, min: number, max: number, count: number }) {
    return sortedArrayAdd(records, value, childrenCompare);
}

export function arraySplit<T>(records: T[]) {
    if (records.length < 2) {
        throw Error('Not enought items for split');
    }
    let mid = records.length >> 1;
    return {
        left: records.slice(0, mid),
        right: records.slice(mid),
    };
}