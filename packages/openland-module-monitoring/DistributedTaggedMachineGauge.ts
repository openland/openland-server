import { Config } from 'openland-config/Config';
import uuid from 'uuid/v4';
import { DistributedTaggedGauge } from './DistributedTaggedGauge';

/**
 * Same as DistributedGauge, but scope is limited for single process.
 * Useful to report connections count.
 * Automatically reports every 5 seconds with timeout of 10 seconds.
 */
export class DistributedTaggedMachineGauge {
    readonly name: string;
    readonly #id = uuid();
    readonly #gauge: DistributedTaggedGauge;
    #values = new Map<string, number>();

    constructor(name: string, gauge: DistributedTaggedGauge) {
        this.name = name;
        this.#gauge = gauge;
    }

    set = (tag: string, value: number) => {
        if (Config.enableReporting) {
            this.#values.set(tag, value);
        }
    }

    inc = (tag: string) => {
        if (Config.enableReporting) {
            let ex = this.#values.get(tag) || 0;
            this.#values.set(tag, ex + 1);
        }
    }

    dec = (tag: string) => {
        if (Config.enableReporting) {
            let ex = this.#values.get(tag) || 0;
            this.#values.set(tag, ex - 1);
        }
    }

    // @private
    start = () => {
        if (Config.enableReporting) {
            setInterval(() => {
                for (let e of this.#values) {
                    this.#gauge.add(e[0], e[1], this.#id, 10000);
                }
            }, 5000);
        }
    }
}