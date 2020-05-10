import { DistributedGauge } from './DistributedGauge';
import { EventBus } from 'openland-module-pubsub/EventBus';
import { MetricFactory } from './MetricFactory';

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
        return [...this.#values.values()].map((v) => v.value).reduce((p, c) => p + c, 0);
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

export class DistributedCollector {
    #factory: MetricFactory;
    #gaugeCollectors = new Map<string, GaugeCollector>();

    constructor(factory: MetricFactory) {
        this.#factory = factory;
        EventBus.subscribe('metric', this.#onMetric);
        for (let gauge of this.#factory.getAllGauges()) {
            this.#gaugeCollectors.set(gauge.name, new GaugeCollector(gauge));
        }
    }

    getPrometheusReport = () => {
        let res: string[] = [];
        for (let collector of this.#gaugeCollectors.values()) {
            let gauge = collector.gauge;
            let resolved = collector.resolve();
            res.push('# HELP ' + gauge.name + ' ' + gauge.description);
            res.push('# TYPE ' + gauge.name + ' gauge');
            res.push(gauge.name + ' ' + resolved);
        }
        return res.join('\n');
    }

    #onMetric = (src: any) => {
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
        }
    }
}