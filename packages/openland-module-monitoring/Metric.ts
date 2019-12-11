import { Context, ContextName } from '@openland/context';
let map = new Map<string, Metric>();

export function getAllMetrics() {
    let global: any = {};
    let context: any = {};

    for (let e of map.entries()) {
        let r = e[1].getAndReset();
        if (r !== null) {
            global[e[0]] = r.global;
            for (let k in r.context) {
                if (!context[k]) {
                    context[k] = {};
                }
                context[k][e[0]] = r.context[k];
            }
        }
    }
    return { global, context };
}

export class Metric {
    private readonly mode: 'sum' | 'average';
    private _count = 0;
    private _value = 0;
    private _contexts = new Map<string, { count: number, value: number }>();

    constructor(mode: 'sum' | 'average') {
        this.mode = mode;
    }

    getAndReset = () => {
        if (this.mode === 'sum') {
            let res = this._value;
            this._value = 0;
            this._count = 0;
            let result: any = { global: res, context: {} };
            for (let e of this._contexts.entries()) {
                let key = e[0];
                let v = e[1];
                result.context[key] = v.value;
                v.value = 0;
                v.count = 0;
            }
            return result;
        } else {
            if (this._count > 0) {
                let res = this._value / this._count;
                this._value = 0;
                this._count = 0;
                let result: any = { global: res, context: {} };
                for (let e of this._contexts.entries()) {
                    let key = e[0];
                    let v = e[1];
                    if (v.count > 0) {
                        result.context[key] = v.value / v.count;
                        v.value = 0;
                        v.count = 0;
                    }
                }
                return result;
            } else {
                return null;
            }
        }
    }

    increment = (ctx: Context) => {
        this._count++;
        this._value++;

        let name = ContextName.get(ctx);
        if (!this._contexts.has(name)) {
            this._contexts.set(name, { count: 0, value: 0 });
        }
        let ctxCounter = this._contexts.get(name)!!;
        ctxCounter.count++;
        ctxCounter.value++;
    }

    decrement = (ctx: Context) => {
        this._count--;
        this._value--;

        let name = ContextName.get(ctx);
        if (!this._contexts.has(name)) {
            this._contexts.set(name, { count: 0, value: 0 });
        }
        let ctxCounter = this._contexts.get(name)!!;
        ctxCounter.count--;
        ctxCounter.value--;
    }

    add = (ctx: Context, value: number) => {
        this._count++;
        this._value += value;

        let name = ContextName.get(ctx);
        if (!this._contexts.has(name)) {
            this._contexts.set(name, { count: 0, value: 0 });
        }
        let ctxCounter = this._contexts.get(name)!!;
        ctxCounter.count++;
        ctxCounter.value += value;
    }
}

export function createMetric(name: string, mode: 'sum' | 'average') {
    if (map.has(name)) {
        throw Error('Metric already registered');
    }
    let res = new Metric(mode);
    map.set(name, res);
    return res;
}