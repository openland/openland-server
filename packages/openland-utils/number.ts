export function max(...numbers: number[]) {
    return numbers.reduce((acc, a) => a > acc ? a : acc, 0);
}