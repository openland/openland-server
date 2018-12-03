export const batch: <T>(items: T[], batchSize: number) => T[][] = <T>(items: T[], batchSize: number) => {
    return items.reduce(
        (res, x) => {
            let b = res[res.length - 1];
            if ((b && b.length >= batchSize) || !b) {
                b = [];
                res.push(b);
            }
            b.push(x);
            return res;
        },
        [[]] as T[][]);
};
