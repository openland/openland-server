import { TupleItem } from '@openland/foundationdb';

function removePrefix(src: TupleItem[], prefix: TupleItem[]): TupleItem[] {
    if (prefix.length === 0) {
        return src;
    }
    let key = [...src];

    let hasNamespacePrefix = true;
    let i = 0;
    for (let k2 of prefix) {
        if (key[i] !== k2) {
            hasNamespacePrefix = false;
        }
    }
    if (hasNamespacePrefix) {
        key.splice(0, prefix.length);
    }

    return key;
}

export function fixObsoleteCursor(src: TupleItem[], namespace: TupleItem[], subspace: TupleItem[]): TupleItem[] {
    return removePrefix(removePrefix(src, namespace), subspace);
}