function unescape(str: string) {
    return (str + '==='.slice((str.length + 3) % 4))
        .replace(/-/g, '+')
        .replace(/_/g, '/');
}

function escape(str: string) {
    return str.replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '')
}

function encode(str: string, encoding?: string) {
    return escape(Buffer.from(str, encoding || 'utf8').toString('base64'));
}

function decode(str: string, encoding?: string) {
    return Buffer.from(unescape(str), 'base64').toString(encoding || 'utf8');
}

export function buildId(src: number, type: string) {
    if (src < 0) {
        throw Error('Ids can\'t be negative!');
    }
    return encode(src.toString() + '|' + type.toLowerCase());
}

export function parseId(src: string, type: string) {
    type = type.toLowerCase();
    let decoded = decode(src);
    let parts = decoded.split('|', 2);
    if (parts[1] !== type) {
        throw Error(`Type mismatch. Expected: ${type}, got ${parts[1]}`);
    }
    return parseInt(parts[0], 10);
}