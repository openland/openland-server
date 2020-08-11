import os from 'os';
import { DistributedTaggedGauge } from './DistributedTaggedGauge';

/**
 * Same as DistributedGauge, but scope is limited for single process.
 * Useful to report connections count.
 * Automatically reports every 5 seconds with timeout of 10 seconds.
 */
export class DistributedTaggedMachineGauge {
    readonly name: string;
    readonly #hostname = os.hostname();
    readonly #gauge: DistributedTaggedGauge;
    #value: number = 0;

    constructor(name: string, gauge: DistributedTaggedGauge) {
        this.name = name;
        this.#gauge = gauge;
    }

    set = (value: number) => {
        this.#value = value;
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
            this.#gauge.add(this.#hostname, this.#value, this.#hostname, 10000);
        }, 5000);
    }
}