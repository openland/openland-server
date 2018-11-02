import Crypto from 'crypto';
import Hashids from 'hashids';
import { decodeBuffer, encodeBuffer } from '../openland-server/utils/base64';
import { IDMailformedError } from '../openland-server/errors/IDMailformedError';

// Randomly generated string for using as salt for type name hashing
const typeKeySalt = '2773246209f10fc3381f5ca55c67dac5486e27ff1ce3f698b1859008fe0053e3';
// Randomly generated string for using as salt for encryption key derivation
const encryptionKeySalt = 'a638abdfb70e39476858543b3216b23ca5d1ac773eaf797a130639a76081c3aa';
// Randomly generated string for using as salt for encryption iv derivation
const encryptionIvSalt = '4c66c9e004fb48caaa38aa72dc749f946d0ccfe4edf8f993776388b6349a2895';
// Randomly generated string for using as salt for hmac secret derivation
const hmacSecretSalt = 'c15c63b812d78d8e368f2d702e43dd885f3bcf0e446203951b12cf3ab9715716';
// Randomly generated string for using as salt for hashds salt derivation
const hashidsSalt = '11705939e5cad46fa04a6fc838a3fa25c0f50439c946101199b8506ff73a2ebe';

// Contant for current version of an ID
const CURRENT_VERSION = 1;
// Expected Key Length
const KEY_LENGTH = 15;
// Truncated size of HMAC
const HMAC_LENGTH = 8;

export type SecIDStyle = 'hex' | 'base64' | 'hashids';

function decodeStyle(value: string, style: SecIDStyle, hashids: Hashids) {
    if (style === 'hex') {
        return Buffer.from(value, 'hex');
    } else if (style === 'base64') {
        return decodeBuffer(value);
    } else {
        let hid = hashids.decodeHex(value);
        return Buffer.from(hid, 'hex');
    }
}

function encodeStyle(value: Buffer, style: SecIDStyle, hashids: Hashids) {
    if (style === 'hex') {
        return value.toString('hex');
    } else if (style === 'base64') {
        return encodeBuffer(value);
    } else {
        return hashids.encodeHex(value.toString('hex'));
    }
}

function encrypt(value: number, typeId: number, encryptionKey: Buffer, encryptionIv: Buffer, hmacKey: Buffer) {
    // Preflight check
    if (value < 0) {
        throw new IDMailformedError('Ids can\'t be negative!');
    }
    if (!Number.isInteger(value)) {
        throw new IDMailformedError('Ids can\'t be float numbers! Got: ' + value);
    }
    if (value > 2147483647) {
        throw new IDMailformedError('Ids can\'t be bigger than 2147483647. Got: ' + value);
    }

    let buf = new Buffer(7);
    // Write version
    buf.writeInt8(CURRENT_VERSION, 0);
    // Write type id
    buf.writeUInt16BE(typeId, 1);
    // Write id
    buf.writeInt32BE(value, 3);

    // Encrypt
    let cipher = Crypto.createCipheriv('aes-128-ctr', encryptionKey, encryptionIv);
    let res = cipher.update(buf);
    res = Buffer.concat([res, cipher.final()]);

    // then MAC
    let hmac = Crypto.createHmac('sha256', hmacKey).update(res).digest().slice(0, HMAC_LENGTH);
    res = Buffer.concat([res, hmac]);

    return res;
}

function decrypt(value: Buffer, type: number | Set<number>, encryptionKey: Buffer, encryptionIv: Buffer, hmacKey: Buffer) {
    // This code need to have constant time
    let decipher = Crypto.createDecipheriv('aes-128-ctr', encryptionKey, encryptionIv);

    let sourceContent = value.slice(0, 7);
    let sourceHmac = value.slice(7);

    // Decryption
    let decoded = decipher.update(sourceContent);
    decoded = Buffer.concat([decoded, decipher.final()]);

    // Hmac
    let hmacActual = Crypto.createHmac('sha256', hmacKey).update(sourceContent).digest().slice(0, HMAC_LENGTH);

    // For consant time read evertyhing before checking
    let hmacCorrect = Crypto.timingSafeEqual(hmacActual, sourceHmac);
    let valueVersion = decoded.readUInt8(0);
    let valueTypeId = decoded.readUInt16BE(1);
    let valueRes = decoded.readUInt32BE(3);

    // Constant time integrity check
    let correctVersion = valueVersion === 1;
    let correctType = false;
    if (typeof type === 'number') {
        correctType = valueTypeId === type;
    } else {
        correctType = type.has(valueTypeId);
    }
    if (correctType && correctVersion && hmacCorrect) {
        return { id: valueRes, type: valueTypeId };
    }
    throw new IDMailformedError('Invalid id');
}

export class SecID {
    public readonly typeName: string;
    public readonly typeId: number;
    private readonly encryptionKey: Buffer;
    private readonly encryptionIv: Buffer;
    private readonly hmacKey: Buffer;
    private readonly style: SecIDStyle;
    private readonly hashids: Hashids;

    constructor(
        typeName: string,
        typeId: number,
        encryptionKey: Buffer,
        encryptionIv: Buffer,
        hmacKey: Buffer,
        style: SecIDStyle,
        hashids: Hashids) {
        this.typeName = typeName;
        this.typeId = typeId;
        this.encryptionKey = encryptionKey;
        this.encryptionIv = encryptionIv;
        this.hmacKey = hmacKey;
        this.style = style;
        this.hashids = hashids;
    }

    serialize(value: number) {
        let encrypted = encrypt(value, this.typeId, this.encryptionKey, this.encryptionIv, this.hmacKey);
        return encodeStyle(encrypted, this.style, this.hashids);
    }

    parse(value: string) {

        // Decode style
        let source = decodeStyle(value, this.style, this.hashids);
        if (source.length !== KEY_LENGTH) {
            throw new IDMailformedError('Invalid id');
        }

        return decrypt(source, this.typeId, this.encryptionKey, this.encryptionIv, this.hmacKey).id;
    }
}

export class SecIDFactory {
    private readonly typeSalt: string;
    private readonly encryptionKey: Buffer;
    private readonly encryptionIv: Buffer;
    private readonly hmacKey: Buffer;
    private readonly style: SecIDStyle;
    private readonly hashids: Hashids;
    private knownTypes = new Set<number>();
    private knownSecIDS = new Map<number, SecID>();

    constructor(secret: string, style: SecIDStyle = 'hashids') {
        this.style = style;
        this.typeSalt = Crypto.pbkdf2Sync(secret, typeKeySalt, 100000, 32, 'sha512').toString('hex');
        this.encryptionKey = Crypto.pbkdf2Sync(secret, encryptionKeySalt, 100000, 16, 'sha512');
        this.encryptionIv = Crypto.pbkdf2Sync(secret, encryptionIvSalt, 100000, 16, 'sha512');
        this.hmacKey = Crypto.pbkdf2Sync(secret, hmacSecretSalt, 100000, 64, 'sha512');
        this.hashids = new Hashids(Crypto.pbkdf2Sync(secret, hashidsSalt, 100000, 32, 'sha512').toString('hex'));
    }

    createId(type: string) {
        // Hashing of type name
        // We don't need to make this hash secure. 
        // Just to "compress" and use hash instead of a full name.

        // Using simple hash: sha1
        let hash = Crypto.createHash('sha1');
        // Append type salt to avoid duplicates in different factory instances (with different secret).
        hash.update(this.typeSalt, 'utf8');
        // Append type as is
        hash.update(type.toLowerCase(), 'utf8');
        // Read first two bytes of hash
        let res = hash.digest();
        let typeId = res.readUInt16BE(0);

        // Check for uniques since there could be collisions
        if (this.knownTypes.has(typeId)) {
            throw Error('SecID type collision for "' + type + '", please try to use different name.');
        }
        this.knownTypes.add(typeId);

        // Build SecID instance
        let id = new SecID(type, typeId, this.encryptionKey, this.encryptionIv, this.hmacKey, this.style, this.hashids);
        this.knownSecIDS.set(typeId, id);
        return id;
    }

    resolve(value: string) {
        let source = decodeStyle(value, this.style, this.hashids);
        if (source.length !== KEY_LENGTH) {
            throw new IDMailformedError('Invalid id');
        }
        let res = decrypt(source, this.knownTypes, this.encryptionKey, this.encryptionIv, this.hmacKey);
        return {
            id: res.id,
            type: this.knownSecIDS.get(res.type)!!
        };
    }
}