import { DistributedGauge } from './DistributedGauge';
import { DistributedMachineGauge } from './DistributedMachineGauge';

export class MetricFactory {

    #gauges = new Map<string, DistributedGauge>();

    getAllGauges() {
        return [...this.#gauges.values()];
    }

    createGauge = (name: string, description: string) => {
        if (this.#gauges.has(name)) {
            throw Error('Gauge already exists');
        }
        let res = new DistributedGauge(name, description);
        this.#gauges.set(name, res);
        return res;
    }

    createMachineGauge = (name: string, description: string) => {
        let gauge = this.createGauge(name, description);
        return new DistributedMachineGauge(name, gauge);
    }
}