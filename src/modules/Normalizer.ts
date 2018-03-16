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

export function normalizeIds(ids: string[]) {
    let res = new Map<string, string>();
    let unique = new Set<string>();
    for (let id of ids) {
        if (res.has(id)) {
            continue;
        }
        let normalized = normalizeId(id);
        res.set(id, normalized);
        unique.add(normalized);
    }
    return {
        src: ids,
        map: res,
        unique: unique
    };
}

export function normalizeDate(src?: string | null) {
    if (src) {
        let r = new Date(src);
        let d = r.getDate();
        let m = r.getMonth() + 1;
        return `${r.getFullYear()}-${m <= 9 ? '0' + m : m}-${d <= 9 ? '0' + d : d}`;
    } else {
        return null;
    }
}