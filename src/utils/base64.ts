function unescape(str: string) {
    return (str + '==='.slice((str.length + 3) % 4))
        .replace(/-/g, '+')
        .replace(/_/g, '/');
}

function escape(str: string) {
    return str.replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

export function encode(str: string, encoding?: string) {
    return escape(Buffer.from(str, encoding || 'utf8').toString('base64'));
}

export function encodeBuffer(buffer: Buffer, encoding?: string) {
    return escape(buffer.toString('base64'));
}

export function decode(str: string, encoding?: string) {
    return Buffer.from(unescape(str), 'base64').toString(encoding || 'utf8');
}