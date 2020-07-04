import { DistributedSummary } from './DistributedSummary';
import { DistributedFrequencyGauge } from './DistributedFrequencyGauge';
import { PersistedGauge } from './PersistedGauge';
import { Context } from '@openland/context';
import { DistributedGauge } from './DistributedGauge';
import { DistributedMachineGauge } from './DistributedMachineGauge';
import { DistributedTaggedSummary } from './DistributedTaggedSummary';

export class MetricFactory {

    #gauges = new Map<string, DistributedGauge>();
    #machineGauges = new Map<string, DistributedMachineGauge>();
    #persistedGauges = new Map<string, PersistedGauge>();
    #frequencyGauges = new Map<string, DistributedFrequencyGauge>();
    #summaries = new Map<string, DistributedSummary>();
    #taggedSummaries = new Map<string, DistributedTaggedSummary>();

    getAllMetrics() {
        return {
            gauges: [...this.#gauges.values()],
            persistedGauges: [...this.#persistedGauges.values()],
            summaries: [...this.#summaries.values()],
            taggedSummaries: [...this.#taggedSummaries.values()]
        };
    }

    createGauge = (name: string, description: string) => {
        this.ensureNameIsNotUsed(name);

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
        this.ensureNameIsNotUsed(name);

        let res = new PersistedGauge(name, description, query);
        this.#persistedGauges.set(name, res);
        return res;
    }

    createSummary = (name: string, description: string, quantiles: number[]) => {
        this.ensureNameIsNotUsed(name);

        let res = new DistributedSummary(name, description, quantiles);
        this.#summaries.set(name, res);
        return res;
    }

    createTaggedSummary = (name: string, description: string, quantiles: number[], tags: string[]) => {
        this.ensureNameIsNotUsed(name);

        let res = new DistributedTaggedSummary(name, description, quantiles, tags);
        this.#taggedSummaries.set(name, res);
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

    private ensureNameIsNotUsed(name: string) {
        if (this.#gauges.has(name) || this.#persistedGauges.has(name) || this.#summaries.has(name) || this.#taggedSummaries.has(name)) {
            throw Error('Name already used');
        }
    }
}