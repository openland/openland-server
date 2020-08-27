import { encoders } from '@openland/foundationdb';

export function createStateLost(seq: number, state: Buffer) {
    return encoders.tuple.pack([2, seq, state]).toString('hex');
}

export function createCheckpoint(seq: number, state: Buffer) {
    return encoders.tuple.pack([3, seq, state]).toString('hex');
}

export function createMissing(seq: number, feed: Buffer, fseq: number) {
    return encoders.tuple.pack([4, seq, feed, fseq]).toString('hex');
}