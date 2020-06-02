export class SimpleFactory<T> {
    #factory: (key: string) => T;
    #cache = new Map<string, T>();

    constructor(factory: (key: string) => T) {
        this.#factory = factory;
    }

    get = (key: string) => {
        let ex = this.#cache.get(key);
        if (ex) {
            return ex;
        } else {
            let r = this.#factory(key);
            this.#cache.set(key, r);
            return r;
        }
    }
}