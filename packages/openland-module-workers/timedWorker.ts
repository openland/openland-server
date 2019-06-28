import { DelayedQueue } from './DelayedQueue';
import { inTx } from '@openland/foundationdb';
import { createNamedContext, Context } from '@openland/context';
import { FDB } from '../openland-module-db/FDB';
import { JsonMap } from '../openland-utils/json';

export enum WeekDay {
    Sunday = 0,
    Monday = 1,
    Tuesday = 2,
    Wednesday = 3,
    Thursday = 4,
    Friday = 5,
    Saturday = 6,
}

type Config =
    { interval: 'every-week', time: { minutes: number, hours: number, weekDay: WeekDay, } }
    | { interval: 'every-day', time: { minutes: number, hours: number } }
    | { interval: 'every-hour', time: { minutes: number } };

const rootCtx = createNamedContext('kek');
export const timedWorker = async <Res extends JsonMap>(type: string, conf: Config, handler: (ctx: Context) => Promise<Res>) => {
    const taskType = 'timed_' + type;
    const queue = new DelayedQueue<{}, Res>(taskType);

    const getNext = () => {
        const now = new Date();
        const weekDay = now.getDay();
        const minuteNow = now.getMinutes();
        const hourNow = now.getHours();
        const isNotToday = (hours: number, minutes: number) => hourNow > hours || (hourNow === hours && minuteNow > minutes);

        let nextDate = Date.now();
        if (conf.interval === 'every-week') {

            /**
             * There are three cases:
             *  1 - if task should be started in this week
             *  2 - if task should be started in next week
             *  3 - if task should be started today
             *
             *  In third case we don't need to shift days, so ignore it by second condition
             */

            if (conf.time.weekDay > weekDay) {
                nextDate += 1000 * 60 * 60 * 24 * (conf.time.weekDay - weekDay); // this week
            } else if (conf.time.weekDay < weekDay || isNotToday(conf.time.hours, conf.time.minutes)) {
                nextDate += 1000 * 60 * 60 * 24 * (7 - weekDay + conf.time.weekDay); // next week
            }
            return new Date(nextDate).setHours(conf.time.hours, conf.time.minutes, 0);
        } else if (conf.interval === 'every-day') {
            if (isNotToday(conf.time.hours, conf.time.minutes)) {
                nextDate += 1000 * 60 * 60 * 24;
            }
            return new Date(nextDate).setHours(conf.time.hours, conf.time.minutes, 0);
        } else {
            if (minuteNow > conf.time.minutes) {
                nextDate += 1000 * 60 * 60;
            }
            return new Date(nextDate).setMinutes(conf.time.minutes, 0);
        }
    };

    const pushNext = (ctx: Context) => queue.pushWork(ctx, {}, getNext());

    await inTx(rootCtx, async (ctx) => {
        let pending = await FDB.DelayedTask.allFromPending(ctx, taskType);
        if (pending.length === 0) {
            await pushNext(ctx);
        }
    });

    queue.start(async (_, ctx) => {
        let res = await handler(ctx);
        await pushNext(ctx);
        return res;
    });
};