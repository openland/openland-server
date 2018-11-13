import { SafeContext } from 'openland-utils/SafeContext';

export class FCacheContext {
    static readonly context = new SafeContext<FCacheContext>();
    private static nextId = 1;

    readonly id = FCacheContext.nextId++;
    private cache = new Map<string, any>();

    findInCache(key: string): any | null | undefined {
        if (this.cache.has(key)) {
            return this.cache.get(key);
        } else {
            return undefined;
        }
    }

    putInCache(key: string, value: any | null) {
        this.cache.set(key, value);
    }
}