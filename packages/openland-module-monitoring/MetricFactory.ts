import { PersistedGauge } from './PersistedGauge';
import { Context } from '@openland/context';
import { DistributedGauge } from './DistributedGauge';
import { DistributedMachineGauge } from './DistributedMachineGauge';

export class MetricFactory {

    #gauges = new Map<string, DistributedGauge>();
    #machineGauges = new Map<string, DistributedMachineGauge>();
    #persistedGauges = new Map<string, PersistedGauge>();

    getAllMetrics() {
        return {
            gauges: [...this.#gauges.values()],
            persistedGauges: [...this.#persistedGauges.values()]
        };
    }

    createGauge = (name: string, description: string, func: 'sum' | 'median' = 'sum') => {
        if (this.#gauges.has(name) || this.#persistedGauges.has(name)) {
            throw Error('Gauge already exists');
        }
        let res = new DistributedGauge(name, description, func);
        this.#gauges.set(name, res);
        return res;
    }

    createMachineGauge = (name: string, description: string, func: 'sum' | 'median' = 'sum') => {
        let gauge = this.createGauge(name, description, func);
        let res = new DistributedMachineGauge(name, gauge);
        this.#machineGauges.set(name, res);
        return res;
    }

    createPersistedGauge = (name: string, description: string, query: (ctx: Context) => Promise<number>) => {
        if (this.#gauges.has(name) || this.#persistedGauges.has(name)) {
            throw Error('Gauge already exists');
        }
        let res = new PersistedGauge(name, description, query);
        this.#persistedGauges.set(name, res);
        return res;
    }

    start = () => {
        for (let gauge of this.#machineGauges.values()) {
            gauge.start();
        }
    }
}