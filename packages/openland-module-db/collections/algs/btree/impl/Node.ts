import { encoders, TupleItem } from '@openland/foundationdb';
import { sortedArrayAdd } from '../../utils/sortedArrayAdd';

export type LeafNode = {
    type: 'leaf',
    id: number,
    parent: number | null,
    children: number[];
};

export type InternalNode = {
    type: 'internal',
    id: number,
    parent: number | null,
    children: { count: number, min: number, max: number, node: number }[]
};

export type Node = LeafNode | InternalNode;

export function packNode(src: Node): Buffer {
    if (src.type === 'leaf') {
        return encoders.tuple.pack([
            0,
            src.id,
            src.parent,
            src.children.length,
            ...src.children
        ]);
    } else if (src.type === 'internal') {
        return encoders.tuple.pack([
            1,
            src.id,
            src.parent,
            src.children.length,
            ...(([] as TupleItem[]).concat(...src.children.map((r) => [r.node, r.min, r.max, r.count])))
        ]);
    } else {
        throw Error('invalid node type');
    }
}

export function unpackNode(src: Buffer): Node {
    let tuple = encoders.tuple.unpack(src);
    if (tuple[0] === 0) {
        let offset = 1;

        // Parent
        let id = tuple[offset++] as number;
        let parent = tuple[offset++] as number | null;
        let count = tuple[offset++] as number;

        // Read records
        let children: number[] = [];
        for (let i = 0; i < count; i++) {
            children.push(tuple[offset++] as number);
        }

        return {
            type: 'leaf',
            id,
            parent,
            children
        };
    } else if (tuple[0] === 1) {
        let offset = 1;

        // Parent
        let id = tuple[offset++] as number;
        let parent = tuple[offset++] as number | null;
        let count = tuple[offset++] as number;

        // Read children
        let children: { node: number, min: number, max: number, count: number }[] = [];
        for (let i = 0; i < count; i++) {
            children.push({ node: tuple[offset++] as number, min: tuple[offset++] as number, max: tuple[offset++] as number, count: tuple[offset++] as number });
        }

        return {
            type: 'internal',
            id,
            parent,
            children
        };
    } else {
        throw Error('invalid node type');
    }
}

const recordCompare = (a: number, b: number) => a - b;
// const childrenCompare = (a: { count: number, key: number, node: number }, b: { count: number, key: number, node: number }) => a.key - b.key;

export function recordAdd(records: number[], value: number) {
    return sortedArrayAdd(records, value, recordCompare);
}

export function arraySplit<T>(records: T[]) {
    let mid = records.length >> 1;
    return {
        left: records.slice(0, mid),
        right: records.slice(mid),
    };
}