import uuid from 'uuid/v4';
import { DistributedGauge } from './DistributedGauge';

/**
 * Same as DistributedGauge, but scope is limited for single process.
 * Useful to report connections count.
 * Automatically reports every 5 seconds with timeout of 10 seconds.
 */
export class DistributedMachineGauge {
    readonly name: string;
    readonly #id = uuid();
    readonly #gauge: DistributedGauge;
    #value: number = 0;

    constructor(name: string, gauge: DistributedGauge) {
        this.name = name;
        this.#gauge = gauge;
        Object.freeze(this);
    }

    set = (value: number) => {
        this.#value = value;
        this.#gauge.add(this.#value, this.#id, 10000);
    }

    inc = () => {
        this.#value++;
    }

    dec = () => {
        this.#value--;
    }

    // @private
    start = () => {
        setInterval(() => {
            this.#gauge.add(this.#value, this.#id, 10000);
        }, 5000);
    }
}