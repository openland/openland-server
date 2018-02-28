export function normalizeId(id: string) {
    return id.replace(/^0+/, '');
}
export function normalizeCapitalized(str: string) {
    return str.trim().split(' ').map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' ');
}

export function normalizeNullableUserInput(str: string | null) {
    if (str !== null) {
        str = str.trim();
        if (str.length > 0) {
            return str.trim();
        }
    }
    return null;
}