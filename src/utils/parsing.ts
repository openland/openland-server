export function parseIntSafe(src: any) {
    if (typeof src === 'string') {
        try {
            return parseInt(src, 10);
        } catch {
            // Just ignore
        }
    } else if (typeof src === 'number') {
        return src;
    }
    return null;
}

export function parseBoolSafe(src: any): boolean | null {
    if (typeof src === 'string') {
        if (src === 'true') {
            return true;
        } else {
            return false;
        }
    } else if (typeof src === 'boolean') {
        return src;
    }
    return null;
}