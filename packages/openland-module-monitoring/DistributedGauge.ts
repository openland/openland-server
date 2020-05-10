import { EventBus } from 'openland-module-pubsub/EventBus';

/**
 * DistributedGauge calculates sum of distributed reported values with timeout support.
 * Useful for Online counter calculation: report each user with increment and appropriate timeout
 * and total online count will be calculated correctly without duplicates.
 */
export class DistributedGauge {
    readonly name: string;
    readonly description: string;

    constructor(name: string, description: string) {
        this.name = name;
        this.description = description;
        Object.freeze(this);
    }

    /**
     * Increments distributed gauge with timeout.
     * Collector node will summ all increments to calculate 
     * resulting value and will remove value from a set once timeout 
     * is passed.
     */
    inc = (key: string, timeout: number) => {
        this.add(1, key, timeout);
    }

    /**
     * Adds a value to distributed gauge with timeout.
     * Collector node will summ all additions to calculate 
     * resulting value and will remove value from a set once timeout 
     * is passed.
     */
    add = (value: number, key: string, timeout: number) => {
        let time = Date.now();
        EventBus.publish('metric', {
            type: 'gauge',
            name: this.name,
            key: key,
            timeout: timeout,
            value: value,
            time: time
        });
    }
}