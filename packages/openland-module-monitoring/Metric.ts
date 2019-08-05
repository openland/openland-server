let map = new Map<string, Metric>();

export function getAllMetrics() {
    let metrics: any = {};
    for (let e of map.entries()) {
        let r = e[1].getAndReset();
        if (r !== null) {
            metrics[e[0]] = r;
        }
    }
    return metrics;
}

export class Metric {
    private readonly mode: 'sum' | 'average';
    private _count = 0;
    private _value = 0;

    constructor(mode: 'sum' | 'average') {
        this.mode = mode;
    }

    getAndReset = () => {
        if (this.mode === 'sum') {
            let res = this._value;
            this._value = 0;
            this._count = 0;
            return res;
        } else {
            if (this._count > 0) {
                let res = this._value / this._count;
                this._value = 0;
                this._count = 0;
                return res;
            } else {
                return null;
            }
        }
    }

    increment = () => {
        this._count++;
        this._value++;
    }

    add = (value: number) => {
        this._count++;
        this._value += value;
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