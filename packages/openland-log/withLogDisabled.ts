import { SLogContext } from './src/SLogContext';

export function withLogDisabled<T>(callback: () => T): T {
    if (SLogContext.value) {
        return SLogContext.withContext({ path: SLogContext.value.path, disabled: true }, callback);
    } else {
        return SLogContext.withContext({ path: [], disabled: true }, callback);
    }
}