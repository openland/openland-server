import { EventBus } from 'openland-module-pubsub/EventBus';

export class DistributedTaggedSummary {
    readonly name: string;
    readonly description: string;
    readonly quantiles: number[];
    readonly tags: string[];

    constructor(name: string, description: string, quantiles: number[], tags: string[]) {
        this.name = name;
        this.description = description;
        this.quantiles = quantiles;
        this.tags = tags;

        Object.freeze(this);
    }

    /**
     * Report value to be included in summary
     */
    report = (value: number, tag: string) => {
        let time = Date.now();
        EventBus.publish('metric', {
            type: 'tagged_summary',
            name: this.name,
            value: value,
            time: time,
            tag: tag
        });
    }
}