export interface Context {

}

export interface ContextNamespace<T> {
    get(context: Context): T;
    set(context: Context, value: T): Context;
}

export function createEmptyContext(): Context {
    return new ContextHolder({});
}

export function createContextNamespace<T>(name: string, defaultValue?: T): ContextNamespace<T> {
    return new ContextNamespaceHolder<T>(name, defaultValue);
}

class ContextHolder implements Context {
    readonly values: { [key: string]: any };

    constructor(values: { [key: string]: any }) {
        this.values = values;
    }
}

export abstract class ContextWrapper implements Context {
    readonly ctx: Context;

    constructor(src: Context) {
        this.ctx = src;
    }
}

class ContextNamespaceHolder<T> implements ContextNamespace<T> {
    readonly name: string;
    readonly defaultValue: T | undefined;

    constructor(name: string, defaultValue?: T) {
        this.name = name;
        this.defaultValue = defaultValue;
    }

    get(context: Context): T {
        let raw: ContextHolder;
        if (context instanceof ContextHolder) {
            raw = context;
        } else {
            raw = (context as ContextWrapper).ctx as ContextHolder;
        }
        let val = raw.values[this.name];
        if (val) {
            return val as T;
        } else {
            if (this.defaultValue === undefined) {
                throw Error('Context ' + this.name + ' is not set');
            } else {
                return this.defaultValue;
            }
        }
    }

    set(context: Context, value: T | undefined): Context {
        let raw: ContextHolder;
        if (context instanceof ContextHolder) {
            raw = context;
        } else {
            raw = (context as ContextWrapper).ctx as ContextHolder;
        }
        let values = { ...raw.values };
        values[this.name] = value;
        return new ContextHolder(values);
    }
}