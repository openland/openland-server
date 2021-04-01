import { Config } from 'openland-config/Config';
import { EventBus } from 'openland-module-pubsub/EventBus';

export class DistributedTaggedSummary {
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
    report = (tag: string, value: number) => {
        if (Config.enableReporting) {
            let time = Date.now();
            EventBus.publish('metric', {
                type: 'summary-tagged',
                name: this.name,
                tag: tag,
                value: value,
                time: time
            });
        }
    }
}