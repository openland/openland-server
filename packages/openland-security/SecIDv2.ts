import Crypto from 'crypto';
import { IDMailformedError } from 'openland-server/errors/IDMailformedError';
import Hashids from 'hashids';

// Randomly generated string for using as salt for type name hashing
const typeKeySalt = '2773246209f10fc3381f5ca55c67dac5486e27ff1ce3f698b1859008fe0053e3';
// Randomly generated string for using as salt for encryption key derivation
const encryptionKeySalt = 'a638abdfb70e39476858543b3216b23ca5d1ac773eaf797a130639a76081c3aa';
// Randomly generated string for using as salt for encryption iv derivation
const encryptionIvSalt = '4c66c9e004fb48caaa38aa72dc749f946d0ccfe4edf8f993776388b6349a2895';
// Randomly generated string for using as salt for hashds salt derivation
const hashidsSalt = '11705939e5cad46fa04a6fc838a3fa25c0f50439c946101199b8506ff73a2ebe';

// Contant for current version of an ID
const CURRENT_VERSION = 2;

function encrypt(value: string, typeId: number, encryptionKey: Buffer, encryptionIv: Buffer) {

    // TODO: Check if value is a hex!
    // Preflight check
    // if (value < 0) {
    //     throw new IDMailformedError('Ids can\'t be negative!');
    // }
    // if (!Number.isInteger(value)) {
    //     throw new IDMailformedError('Ids can\'t be float numbers!');
    // }
    // if (value > 2147483647) {
    //     throw new IDMailformedError('Ids can\'t be bigger than 2147483647. Got: ' + value);
    // }

    let buf = new Buffer(5);
    // Write version
    buf.writeInt8(CURRENT_VERSION, 0);
    // Write type id
    buf.writeUInt16BE(typeId, 1);
    // Write id
    buf = Buffer.concat([buf, Buffer.from(value, 'hex')]);

    // Encrypt
    let cipher = Crypto.createCipheriv('aes-128-ctr', encryptionKey, encryptionIv);
    let res = cipher.update(buf);
    res = Buffer.concat([res, cipher.final()]);

    return res;
}

function decrypt(value: string, type: number | Set<number>, encryptionKey: Buffer, encryptionIv: Buffer) {
    // This code need to have constant time
    let decipher = Crypto.createDecipheriv('aes-128-ctr', encryptionKey, encryptionIv);

    // Decryption
    let decoded = decipher.update(Buffer.from(value, 'hex'));
    decoded = Buffer.concat([decoded, decipher.final()]);

    // For consant time read evertyhing before checking
    let valueVersion = decoded.readUInt8(0);
    let valueTypeId = decoded.readUInt16BE(1);
    let valueRes = decoded.slice(5).toString('hex');

    // Constant time integrity check
    let correctVersion = valueVersion === CURRENT_VERSION;
    let correctType = false;
    if (typeof type === 'number') {
        correctType = valueTypeId === type;
    } else {
        correctType = type.has(valueTypeId);
    }
    if (correctType && correctVersion) {
        return { id: valueRes, type: valueTypeId };
    }
    throw new IDMailformedError('Invalid id');
}

export class SecIDv2 {
    public readonly typeName: string;
    public readonly typeId: number;
    private readonly encryptionKey: Buffer;
    private readonly encryptionIv: Buffer;
    private readonly hashids: Hashids;

    constructor(typeName: string, typeId: number, encryptionKey: Buffer, encryptionIv: Buffer, hashids: Hashids) {
        this.typeName = typeName;
        this.typeId = typeId;
        this.encryptionKey = encryptionKey;
        this.encryptionIv = encryptionIv;
        this.hashids = hashids;
    }

    serialize(value: string) {
        return this.hashids.encodeHex(encrypt(value, this.typeId, this.encryptionKey, this.encryptionIv).toString('hex'));
    }

    parse(value: string) {
        return decrypt(this.hashids.decodeHex(value), this.typeId, this.encryptionKey, this.encryptionIv).id;
    }
}

export class SecIDv2Factory {
    private readonly typeSalt: string;
    private readonly encryptionKey: Buffer;
    private readonly encryptionIv: Buffer;
    private knownTypes = new Set<number>();
    private knownSecIDS = new Map<number, SecIDv2>();
    private readonly hashids: Hashids;

    constructor(secret: string) {
        this.typeSalt = Crypto.pbkdf2Sync(secret, typeKeySalt, 100000, 32, 'sha512').toString('hex');
        this.encryptionKey = Crypto.pbkdf2Sync(secret, encryptionKeySalt, 100000, 16, 'sha512');
        this.encryptionIv = Crypto.pbkdf2Sync(secret, encryptionIvSalt, 100000, 16, 'sha512');
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
        let id = new SecIDv2(type, typeId, this.encryptionKey, this.encryptionIv, this.hashids);
        this.knownSecIDS.set(typeId, id);
        return id;
    }
}