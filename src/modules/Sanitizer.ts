export const Sanitizer = {
    sanitizeString(str: string | null | undefined): string | null {
        if (str !== null && str !== undefined) {
            str = str.trim();
            if (str.length > 0) {
                return str;
            }
        }
        return null;
    }
};