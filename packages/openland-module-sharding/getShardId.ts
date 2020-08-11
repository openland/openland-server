import { murmurhash } from 'openland-utils/murmurhash';

export function getShardId(value: string | number, ringSize: number): number {
    return murmurhash(value + '') % ringSize;
}