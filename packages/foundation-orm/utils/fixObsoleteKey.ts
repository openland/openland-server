import { FTuple } from 'foundation-orm/encoding/FTuple';

function removePrefix(src: FTuple[], prefix: FTuple[]): FTuple[] {
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

export function fixObsoleteCursor(src: FTuple[], namespace: FTuple[], subspace: FTuple[]): FTuple[] {
    return removePrefix(removePrefix(src, namespace), subspace);
}