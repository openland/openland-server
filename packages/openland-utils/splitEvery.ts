// method has been borrowed from ramda
export const splitEvery = <T>(n: number, list: T[]) => {
    if (n <= 0) {
        throw new Error('First argument to splitEvery must be a positive integer');
    }
    const result = [] as T[][];
    let idx = 0;
    while (idx < list.length) {
        result.push(list.slice(idx, (idx += n)));
    }
    return result;
};
