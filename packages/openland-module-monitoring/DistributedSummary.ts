import { Config } from 'openland-config/Config';
import { EventBus } from 'openland-module-pubsub/EventBus';

export class DistributedSummary {
    readonly name: string;
    readonly description: string;
    readonly quantiles: number[];

    constructor(name: string, description: string, quantiles: number[]) {
        this.name = name;
        this.description = description;
        this.quantiles = quantiles;
        Object.freeze(this);
    }

    /**
     * Report value to be included in summary
     */
    report = (value: number) => {
        if (Config.enableReporting) {
            let time = Date.now();
            EventBus.publish('metrics', 'metric', {
                type: 'summary',
                name: this.name,
                value: value,
                time: time
            });
        }
    }
}