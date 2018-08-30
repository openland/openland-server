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