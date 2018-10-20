import { SLogContext } from './src/SLogContext';

export function withLogContext<T>(path: string | string[], callback: () => T): T {
    if (SLogContext.value) {
        if (typeof path === 'string') {
            return SLogContext.withContext({ path: [...SLogContext.value.path, path], disabled: SLogContext.value.disabled }, callback);
        } else {
            return SLogContext.withContext({ path: [...SLogContext.value.path, ...path], disabled: SLogContext.value.disabled }, callback);
        }
    } else {
        if (typeof path === 'string') {
            return SLogContext.withContext({ path: [path], disabled: false }, callback);
        } else {
            return SLogContext.withContext({ path: path, disabled: false }, callback);
        }
    }
}