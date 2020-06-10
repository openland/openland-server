import { DistributedFrequencyGauge } from './DistributedFrequencyGauge';
import { PersistedGauge } from './PersistedGauge';
import { Context } from '@openland/context';
import { DistributedGauge } from './DistributedGauge';
import { DistributedMachineGauge } from './DistributedMachineGauge';

export class MetricFactory {

    #gauges = new Map<string, DistributedGauge>();
    #machineGauges = new Map<string, DistributedMachineGauge>();
    #persistedGauges = new Map<string, PersistedGauge>();
    #frequencyGauges = new Map<string, DistributedFrequencyGauge>();

    getAllMetrics() {
        return {
            gauges: [...this.#gauges.values()],
            persistedGauges: [...this.#persistedGauges.values()]
        };
    }

    createGauge = (name: string, description: string) => {
        if (this.#gauges.has(name) || this.#persistedGauges.has(name)) {
            throw Error('Gauge already exists');
        }
        let res = new DistributedGauge(name, description);
        this.#gauges.set(name, res);
        return res;
    }

    createMachineGauge = (name: string, description: string) => {
        let gauge = this.createGauge(name, description);
        let res = new DistributedMachineGauge(name, gauge);
        this.#machineGauges.set(name, res);
        return res;
    }

    createFrequencyGauge = (name: string, description: string) => {
        let gauge = this.createMachineGauge(name, description);
        let res = new DistributedFrequencyGauge(gauge);
        this.#frequencyGauges.set(name, res);
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
        for (let gauge of this.#frequencyGauges.values()) {
            gauge.start();
        }
    }
}