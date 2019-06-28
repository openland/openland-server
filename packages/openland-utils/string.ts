export const genTab = (n: number): string => new Array(n).fill('    ').join('');

export function tab(n: number, str: string, skipFirstLine: boolean = false) {
    let out: string[] = [];
    let parts = str.split('\n');
    for (let part of parts) {
        if (part.length === 0) {
            continue;
        }
        if (parts.indexOf(part) === 0 && skipFirstLine) {
            out.push(part);
            continue;
        }
        out.push(genTab(n) + part);
    }
    return out.join('\n');
}

export const plural = (n: number, forms: string[]) => n === 1 ? forms[0] : forms[1];
export const formatNumberWithSign = (n: number): string => (n < 0 ? '' : '+') + n;