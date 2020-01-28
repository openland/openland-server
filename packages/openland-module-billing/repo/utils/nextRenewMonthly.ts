import moment from 'moment';

export function nextRenewMonthly(start: number) {
    return moment.utc(start).add({ month: 1 }).unix() * 1000;
}