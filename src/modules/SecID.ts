import Crypto from 'crypto';

function hashType(type: string, salt: string): Buffer {
    let hash = Crypto.createHash('sha1');
    hash.update('hash:' + salt, 'utf8');
    hash.update(type, 'utf8');
    let res = hash.digest();
    let resBuffer = new Buffer(17);
    res.copy(resBuffer, 0, 0, 17);
    return resBuffer;
}

// function hexToBase64(value: string): string {
//     let res = new Buffer(value, 'hex').toString('base64');
//     while (res.endsWith('=')) {
//         res = res.substring(0, res.length - 1);
//     }
//     return res;
// }

export function encrypt(salt: string, type: string, value: number): string {
    // Cj+UApEKoU6uT9029t80
    // MXxvcmdhbml6YXRpb24

    let buf = new Buffer(5);
    buf.writeInt8(1, 0);
    buf.writeInt32BE(value, 1);
    buf = Buffer.concat([buf, hashType(type, salt)]);
    console.warn(buf.length);
    console.warn(buf.toString('hex'));
    let cipher = Crypto.createCipher('aes-128-ctr', 'encryption:' + salt);
    cipher.setAutoPadding(true);
    let res = cipher.update(buf, 'binary', 'hex');
    res += cipher.final('hex');
    console.warn(res.length / 2);
    return res;
}

export function decrypt(salt: string, type: string, value: string): number {
    let cipher = Crypto.createDecipher('aes-128-ctr', 'encryption:' + salt);
    let decoded = cipher.update(value, 'hex');
    decoded = Buffer.concat([decoded, cipher.final()]);
    console.warn(decoded.toString('hex'));
    console.warn(decoded.length);
    return decoded.readUInt32BE(1);
}