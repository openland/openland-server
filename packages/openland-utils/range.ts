export function range(start: number, stop: number, step: number = 1) {
    let a = [start], b = start;
    while (b < stop - step) {
        a.push(b += step);
    }

    a.push(stop);
    return a;
}