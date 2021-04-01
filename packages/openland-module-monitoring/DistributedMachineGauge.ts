import { Config } from 'openland-config/Config';
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
    }

    set = (value: number) => {
        if (Config.enableReporting) {
            this.#value = value;
        }
    }

    inc = () => {
        if (Config.enableReporting) {
            this.#value++;
        }
    }

    dec = () => {
        if (Config.enableReporting) {
            this.#value--;
        }
    }

    // @private
    start = () => {
        if (Config.enableReporting) {
            setInterval(() => {
                this.#gauge.add(this.#value, this.#id, 10000);
            }, 1000);
        }
    }
}