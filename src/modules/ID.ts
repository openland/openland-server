import * as Base64 from '../utils/base64';

export class ID {
    readonly type: string;
    constructor(type: string) {
        this.type = type;
    }
    serialize = (src: number) => {
        if (src < 0) {
            throw Error('Ids can\'t be negative!');
        }
        if (!Number.isInteger(src)) {
            throw Error('Ids can\'t be float numbers!');
        }
        return Base64.encode(src.toString() + '|' + this.type.toLowerCase());
    }
    parse = (src: string) => {
        let type = this.type.toLowerCase();
        let decoded = Base64.decode(src);
        let parts = decoded.split('|', 2);
        if (parts[1] !== type) {
            throw Error(`Type mismatch. Expected: ${type}, got ${parts[1]}`);
        }
        return parseInt(parts[0], 10);
    }
}