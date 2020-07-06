import { DistributedTaggedSummary } from './DistributedTaggedSummary';
import { DistributedSummary } from './DistributedSummary';
import { PersistedGauge } from './PersistedGauge';
import { createLogger } from '@openland/log';
import { createNamedContext } from '@openland/context';
import { DistributedGauge } from './DistributedGauge';
import { EventBus } from 'openland-module-pubsub/EventBus';
import { MetricFactory } from './MetricFactory';
import { inTx } from '@openland/foundationdb';
const ctx = createNamedContext('collector');
const logger = createLogger('collector');

class GaugeCollector {
    readonly gauge: DistributedGauge;

    constructor(gauge: DistributedGauge) {
        this.gauge = gauge;
    }

    #values = new Map<string, {
        value: number,
        time: number,
        timeout: NodeJS.Timeout
    }>();

    resolve = () => {
        let values = [...this.#values.values()].map((v) => v.value).sort((a, b) => a - b);
        return {
            sum: values.reduce((p, c) => p + c, 0),
            count: values.length,
            median: values[Math.floor(values.length / 2)] || 0,
        };
    }

    report = (value: number, key: string, timeout: number, time: number) => {
        let now = Date.now();

        // Already timeouted
        if (time + timeout <= now) {
            return;
        }

        let ex = this.#values.get(key);
        // Too old report
        if (ex && ex.time >= time) {
            return;
        }

        // Clear old timeout
        if (ex) {
            clearTimeout(ex.timeout);
        }

        // Write new value
        this.#values.set(key, {
            value,
            time,
            timeout: setTimeout(() => { this.#values.delete(key); }, timeout)
        });
    }
}

class SummaryCollector {
    readonly summary: DistributedSummary;
    #lastObservation = 0;
    #values = new Map<number, number>();

    constructor(summary: DistributedSummary) {
        this.summary = summary;
    }

    resolve = () => {
        let res: { p: number, v: number }[] = [];
        let values = [...this.#values.values()].sort((a, b) => a - b);
        if (this.#values.size !== 0) {
            for (let p of this.summary.quantiles) {
                if (p === 0) {
                    res.push({ p, v: values[0] });
                } else {
                    let index = Math.ceil(values.length * p) - 1;
                    res.push({ p, v: values[index] });
                }
            }
        }
        return { percentiles: res, total: values.length, sum: values.reduce((p, c) => p + c, 0) };
    }

    report = (value: number, time: number) => {
        let now = Date.now();
        // Already timeouted
        if (time + 5000 <= now) {
            return;
        }

        let id = this.#lastObservation++;
        this.#values.set(id, value);
        setTimeout(() => {
            this.#values.delete(id);
        }, 5000);
    }
}

class SummaryTaggedCollector {
    readonly summary: DistributedTaggedSummary;
    #lastObservation = 0;
    #values = new Map<string, Map<number, number>>();

    constructor(summary: DistributedTaggedSummary) {
        this.summary = summary;
    }

    resolve = () => {
        let tags: { tag: string, percentiles: { p: number, v: number }[], total: number, sum: number }[] = [];
        for (let k of this.#values.keys()) {
            let values = [...this.#values.get(k)!.values()].sort((a, b) => a - b);
            let percentiles: { p: number, v: number }[] = [];
            if (values.length !== 0) {
                for (let p of this.summary.quantiles) {
                    if (p === 0) {
                        percentiles.push({ p, v: values[0] });
                    } else {
                        let index = Math.ceil(values.length * p) - 1;
                        percentiles.push({ p, v: values[index] });
                    }
                }
            }
            tags.push({ tag: k, percentiles, total: values.length, sum: values.reduce((p, c) => p + c, 0) });
        }
        return { tags };
    }

    report = (tag: string, value: number, time: number) => {
        let now = Date.now();
        // Already timeouted
        if (time + 5000 <= now) {
            return;
        }

        let id = this.#lastObservation++;
        let ex = this.#values.get(tag);
        if (!ex) {
            ex = new Map();
            this.#values.set(tag, ex);
        }
        ex.set(id, value);
        setTimeout(() => {
            ex!.delete(id);
            if (ex!.size === 0) {
                this.#values.delete(tag);
            }
        }, 5000);
    }
}

export class DistributedCollector {
    #factory: MetricFactory;
    #gaugeCollectors = new Map<string, GaugeCollector>();
    #summaryCollectors = new Map<string, SummaryCollector>();
    #summaryTaggedCollectors = new Map<string, SummaryTaggedCollector>();
    #persistedGauges = new Map<string, PersistedGauge>();

    constructor(factory: MetricFactory) {
        this.#factory = factory;
        EventBus.subscribe('metric', this.#onMetric);

        let metrics = this.#factory.getAllMetrics();
        for (let gauge of metrics.gauges) {
            this.#gaugeCollectors.set(gauge.name, new GaugeCollector(gauge));
        }
        for (let persisted of metrics.persistedGauges) {
            this.#persistedGauges.set(persisted.name, persisted);
        }
        for (let summary of metrics.summaries) {
            this.#summaryCollectors.set(summary.name, new SummaryCollector(summary));
        }
        for (let summary of metrics.summariesTagged) {
            this.#summaryTaggedCollectors.set(summary.name, new SummaryTaggedCollector(summary));
        }
    }

    getPrometheusReport = async () => {
        let res: string[] = [];

        // Distributed gauges
        for (let collector of this.#gaugeCollectors.values()) {
            let gauge = collector.gauge;
            let resolved = collector.resolve();
            res.push('# HELP ' + gauge.name + ' ' + gauge.description);
            res.push('# TYPE ' + gauge.name + ' gauge');
            res.push(gauge.name + ' ' + resolved.sum);
        }

        // Summaries
        for (let collector of this.#summaryCollectors.values()) {
            let summary = collector.summary;
            let resolved = collector.resolve();
            res.push('# HELP ' + summary.name + ' ' + summary.description);
            res.push('# TYPE ' + summary.name + ' summary');
            res.push(summary.name + '_sum ' + resolved.sum);
            res.push(summary.name + '_count ' + resolved.total);
            for (let r of resolved.percentiles) {
                res.push(summary.name + '{quantile="' + r.p + '"} ' + r.v);
            }
        }

        // Tagged Summaries
        for (let collector of this.#summaryTaggedCollectors.values()) {
            let summary = collector.summary;
            let resolved = collector.resolve();
            res.push('# HELP ' + summary.name + ' ' + summary.description);
            res.push('# TYPE ' + summary.name + ' summary');
            for (let tag of resolved.tags) {
                res.push(summary.name + '_sum{tag="' + tag.tag + '"} ' + tag.sum);
                res.push(summary.name + '_count{tag="' + tag.tag + '"} ' + tag.total);
                for (let r of tag.percentiles) {
                    res.push(summary.name + '{quantile="' + r.p + '",tag="' + tag.tag + '"} ' + r.v);
                }
            }
        }

        // Persisted gauges
        if (this.#persistedGauges.size > 0) {
            await inTx(ctx, async (tx) => {
                for (let gauge of this.#persistedGauges.values()) {
                    let resolved: number;
                    try {
                        resolved = await gauge.query(tx);
                    } catch (e) {
                        logger.warn(ctx, 'Unable to receive gauge value for ' + gauge.name + '. Skipping reporting.');
                        logger.warn(ctx, e);
                        continue;
                    }
                    res.push('# HELP ' + gauge.name + ' ' + gauge.description);
                    res.push('# TYPE ' + gauge.name + ' gauge');
                    res.push(gauge.name + ' ' + resolved);
                }
            });
        }
        return res.join('\n');
    }

    #onMetric = (src: any) => {
        // logger.log(ctx, 'Received: ' + JSON.stringify(src));
        if (src.type === 'gauge') {
            let name = src.name;
            let timeout = src.timeout;
            let time = src.time;
            let key = src.key;
            let value = src.value;
            if (typeof name !== 'string') {
                return;
            }
            if (typeof key !== 'string') {
                return;
            }
            if (typeof timeout !== 'number') {
                return;
            }
            if (typeof time !== 'number') {
                return;
            }
            if (typeof value !== 'number') {
                return;
            }
            let collector = this.#gaugeCollectors.get(name);
            if (!collector) {
                return;
            }
            collector.report(value, key, timeout, time);
        } else if (src.type === 'summary') {
            let name = src.name;
            let value = src.value;
            let time = src.time;
            if (typeof name !== 'string') {
                return;
            }
            if (typeof time !== 'number') {
                return;
            }
            if (typeof value !== 'number') {
                return;
            }
            let collector = this.#summaryCollectors.get(name);
            if (!collector) {
                return;
            }
            collector.report(value, time);
        } else if (src.type === 'summary-tagged') {
            let name = src.name;
            let tag = src.tag;
            let value = src.value;
            let time = src.time;
            if (typeof name !== 'string') {
                return;
            }
            if (typeof tag !== 'string') {
                return;
            }
            if (typeof time !== 'number') {
                return;
            }
            if (typeof value !== 'number') {
                return;
            }
            let collector = this.#summaryTaggedCollectors.get(name);
            if (!collector) {
                return;
            }
            collector.report(tag, value, time);
        }
    }
}