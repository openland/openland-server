import UUID from 'uuid/v4';
import { randomBytes } from 'crypto';

export function randomKey() {
    return UUID();
}

export function randomGlobalInviteKey() {
    let length = 6;
    let alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = '';

    for (let i = 0; i < length; i++) {
        key += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }

    return key;
}

export function randomInviteKey() {
    let rnd = randomBytes(16);

    return rnd.toString('base64');
}