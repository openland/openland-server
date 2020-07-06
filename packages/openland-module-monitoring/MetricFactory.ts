import { DistributedTaggedMachineGauge } from './DistributedTaggedMachineGauge';
import { DistributedTaggedGauge } from './DistributedTaggedGauge';
import { DistributedTaggedSummary } from './DistributedTaggedSummary';
import { DistributedSummary } from './DistributedSummary';
import { DistributedFrequencyGauge } from './DistributedFrequencyGauge';
import { PersistedGauge } from './PersistedGauge';
import { Context } from '@openland/context';
import { DistributedGauge } from './DistributedGauge';
import { DistributedMachineGauge } from './DistributedMachineGauge';
import { DistributedTaggedFrequencyGauge } from './DistributedTaggedFrequencyGauge';

export class MetricFactory {

    // Base
    #gauges = new Map<string, DistributedGauge>();
    #gaugesTagged = new Map<string, DistributedTaggedGauge>();
    #persistedGauges = new Map<string, PersistedGauge>();
    #summaries = new Map<string, DistributedSummary>();
    #summariesTagged = new Map<string, DistributedTaggedSummary>();

    // Extended
    #machineGauges = new Map<string, DistributedMachineGauge>();
    #machineTaggedGauges = new Map<string, DistributedTaggedMachineGauge>();
    #frequencyGauges = new Map<string, DistributedFrequencyGauge>();
    #frequencyTaggedGauges = new Map<string, DistributedTaggedFrequencyGauge>();

    getAllMetrics() {
        return {
            gauges: [...this.#gauges.values()],
            gaugesTagged: [...this.#gaugesTagged.values()],
            persistedGauges: [...this.#persistedGauges.values()],
            summaries: [...this.#summaries.values()],
            summariesTagged: [...this.#summariesTagged.values()]
        };
    }

    createGauge = (name: string, description: string) => {
        this.#checkName(name);
        let res = new DistributedGauge(name, description);
        this.#gauges.set(name, res);
        return res;
    }

    createTaggedGauge = (name: string, description: string) => {
        this.#checkName(name);
        let res = new DistributedTaggedGauge(name, description);
        this.#gaugesTagged.set(name, res);
        return res;
    }

    createMachineGauge = (name: string, description: string) => {
        let gauge = this.createGauge(name, description);
        let res = new DistributedMachineGauge(name, gauge);
        this.#machineGauges.set(name, res);
        return res;
    }

    createTaggedMachineGauge = (name: string, description: string) => {
        let gauge = this.createTaggedGauge(name, description);
        let res = new DistributedTaggedMachineGauge(name, gauge);
        this.#machineTaggedGauges.set(name, res);
        return res;
    }

    createFrequencyGauge = (name: string, description: string) => {
        let gauge = this.createMachineGauge(name, description);
        let res = new DistributedFrequencyGauge(gauge);
        this.#frequencyGauges.set(name, res);
        return res;
    }

    createTaggedFrequencyGauge = (name: string, description: string) => {
        let gauge = this.createTaggedMachineGauge(name, description);
        let res = new DistributedTaggedFrequencyGauge(gauge);
        this.#frequencyTaggedGauges.set(name, res);
        return res;
    }

    createPersistedGauge = (name: string, description: string, query: (ctx: Context) => Promise<number>) => {
        this.#checkName(name);
        let res = new PersistedGauge(name, description, query);
        this.#persistedGauges.set(name, res);
        return res;
    }

    createSummary = (name: string, description: string, quantiles: number[]) => {
        this.#checkName(name);
        let res = new DistributedSummary(name, description, quantiles);
        this.#summaries.set(name, res);
        return res;
    }

    createTaggedSummary = (name: string, description: string, quantiles: number[]) => {
        this.#checkName(name);
        let res = new DistributedTaggedSummary(name, description, quantiles);
        this.#summariesTagged.set(name, res);
        return res;
    }

    start = () => {
        for (let gauge of this.#machineGauges.values()) {
            gauge.start();
        }
        for (let gauge of this.#machineTaggedGauges.values()) {
            gauge.start();
        }
        for (let gauge of this.#frequencyGauges.values()) {
            gauge.start();
        }
        for (let gauge of this.#frequencyTaggedGauges.values()) {
            gauge.start();
        }
    }

    #checkName = (name: string) => {
        if (this.#gauges.has(name) || this.#persistedGauges.has(name) || this.#summaries.has(name) || this.#summariesTagged.has(name) || this.#gaugesTagged.has(name)) {
            throw Error('Name already used');
        }
    }
}