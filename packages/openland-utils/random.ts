import UUID from 'uuid/v4';

export function randomKey() {
    return UUID();
}

export function randomGlobalInviteKey(len: number = 6) {
    let length = len; // 6;
    let alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = '';

    for (let i = 0; i < length; i++) {
        key += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }

    return key;
}

export function randomInviteKey() {
    return randomGlobalInviteKey(7);
    // let rnd = randomBytes(16);
    //
    // return rnd.toString('base64');
}

export function randomString(len: number) {
    return randomGlobalInviteKey(len);
}

export function randomNumbersString(len: number) {
    let length = len;
    let alphabet = '0123456789';
    let key = '';

    for (let i = 0; i < length; i++) {
        key += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
    }

    return key;
}

export function randomInt(min: number, max: number) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min)) + min;
}