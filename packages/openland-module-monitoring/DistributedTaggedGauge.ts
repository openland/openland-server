import { EventBus } from 'openland-module-pubsub/EventBus';

/**
 * DistributedGauge calculates a specific function of distributed reported values with timeout support.
 * Useful for Online counter calculation: report each user with increment and appropriate timeout
 * and total online count will be calculated correctly without duplicates.
 */
export class DistributedTaggedGauge {
    readonly name: string;
    readonly description: string;

    constructor(name: string, description: string) {
        this.name = name;
        this.description = description;
        Object.freeze(this);
    }

    /**
     * Adds a value to distributed gauge with timeout.
     * Collector node will resolve all additions to calculate
     * resulting value and will remove value from a set once timeout 
     * is passed.
     */
    add = (tag: string, value: number, key: string, timeout: number) => {
        let time = Date.now();
        EventBus.publish('metric', {
            type: 'gauge-tagged',
            name: this.name,
            key: key,
            tag: tag,
            timeout: timeout,
            value: value,
            time: time
        });
    }
}