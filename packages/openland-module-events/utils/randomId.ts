import crypto from 'crypto';

export function randomId(): Buffer {
    let res = Buffer.alloc(16);
    crypto.randomFillSync(res);
    return res;
}