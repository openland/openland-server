import { Context, createNamedContext } from '@openland/context';
import { JsonMap } from '../openland-utils/json';
import { inTx } from '@openland/foundationdb';
import { BetterWorkerQueue } from './BetterWorkerQueue';
import { QueueStorage } from './QueueStorage';

export enum WeekDay {
    Sunday = 0,
    Monday = 1,
    Tuesday = 2,
    Wednesday = 3,
    Thursday = 4,
    Friday = 5,
    Saturday = 6,
}

type IntervalConfig =
    { interval: 'every-week', time: { minutes: number, hours: number, weekDay: WeekDay, } }
    | { interval: 'every-day', time: { minutes: number, hours: number } }
    | { interval: 'every-hour', time: { minutes: number } };

type Config = IntervalConfig & { maxAttempts?: number };

export class ScheduledQueue<RES extends JsonMap> {
    private readonly queue: BetterWorkerQueue<{}>;
    constructor(storage: QueueStorage, private readonly conf: Config) {
        this.queue = new BetterWorkerQueue<{}>(storage, {
            maxAttempts: conf.maxAttempts || 5,
            type: 'external'
        });
    }

    addWorker = (handler: (ctx: Context) => void | Promise<void>) => {
        this.queue.addWorkers(1, async (ctx) => {
            await handler(ctx);
            await this.ensureNextScheduled(ctx);
        });

        let root = createNamedContext('scheduler-' + this.queue.getName());
        // tslint:disable-next-line:no-floating-promises
        (async () => {
            await inTx(root, async (ctx) => {
                await this.ensureNextScheduled(ctx);
            });
        })();
    }

    pushImmediateWork = async (ctx: Context) => {
        await this.queue.pushWork(ctx, {});
    }

    private getNext = () => {
        const now = new Date();
        const weekDay = now.getDay();
        const minuteNow = now.getMinutes();
        const hourNow = now.getHours();

        const isNotToday = (hours: number, minutes: number) => hourNow > hours || (hourNow === hours && minuteNow >= minutes);

        let nextDate = Date.now();
        if (this.conf.interval === 'every-week') {

            /**
             * There are three cases:
             *  1 - if task should be started in this week
             *  2 - if task should be started in next week
             *  3 - if task should be started today
             *
             *  In third case we don't need to shift days, so ignore it by second condition
             */

            if (this.conf.time.weekDay > weekDay) {
                nextDate += 1000 * 60 * 60 * 24 * (this.conf.time.weekDay - weekDay); // this week
            } else if (this.conf.time.weekDay < weekDay || isNotToday(this.conf.time.hours, this.conf.time.minutes)) {
                nextDate += 1000 * 60 * 60 * 24 * (7 - weekDay + this.conf.time.weekDay); // next week
            }
            return new Date(nextDate).setHours(this.conf.time.hours, this.conf.time.minutes, 0);
        } else if (this.conf.interval === 'every-day') {
            if (isNotToday(this.conf.time.hours, this.conf.time.minutes)) {
                nextDate += 1000 * 60 * 60 * 24;
            }
            return new Date(nextDate).setHours(this.conf.time.hours, this.conf.time.minutes, 0);
        } else {
            if (minuteNow >= this.conf.time.minutes) {
                nextDate += 1000 * 60 * 60;
            }
            return new Date(nextDate).setMinutes(this.conf.time.minutes, 0);
        }
    }

    private ensureNextScheduled = async (ctx: Context) => {
        let scheduled = await this.queue.getScheduled(ctx);
        if (scheduled > 0) {
            return;
        }

        await this.queue.pushWork(ctx, {}, this.getNext());
    }
}