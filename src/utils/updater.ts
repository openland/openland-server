export function applyAlterString(src: string | null) {
    if (src == null) {
        return null;
    } else {
        src = src.trim();
        if (src.length === 0) {
            return null;
        } else {
            return src;
        }
    }
}