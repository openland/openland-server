export function isPromise(x: any): x is Promise<any> {
    return x && typeof x.then === 'function';
}