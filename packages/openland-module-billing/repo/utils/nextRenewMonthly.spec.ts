import moment from 'moment';
import { nextRenewMonthly } from './nextRenewMonthly';

describe('nextRenewMonthly', () => {
    it('should correctly increment start date', () => {
        let date = Date.UTC(2010, 10, 2, /* time -> */ 12, 34, 43, 123 /* <- time */);
        let next = nextRenewMonthly(date);
        let nextDate = moment.utc(next);

        // Next Month Same Date
        expect(nextDate.year()).toBe(2010);
        expect(nextDate.month()).toBe(11);
        expect(nextDate.date()).toBe(2);

        // Same Time
        expect(nextDate.hour()).toBe(12);
        expect(nextDate.minute()).toBe(34);
        expect(nextDate.second()).toBe(43);
    });

    it('should correctly increment year', () => {
        let date = Date.UTC(2010, 11, 2, /* time -> */ 12, 34, 43, 123 /* <- time */);
        let next = nextRenewMonthly(date);
        let nextDate = moment.utc(next);

        // Next Month Same Date
        expect(nextDate.year()).toBe(2011);
        expect(nextDate.month()).toBe(0);
        expect(nextDate.date()).toBe(2);

        // Same Time
        expect(nextDate.hour()).toBe(12);
        expect(nextDate.minute()).toBe(34);
        expect(nextDate.second()).toBe(43);
    });

    it('should correctly adjust last day', () => {
        let date = Date.UTC(2010, 0, 31, /* time -> */ 12, 34, 43, 123 /* <- time */);
        let next = nextRenewMonthly(date);
        let nextDate = moment.utc(next);

        // Next Month Same Date
        expect(nextDate.year()).toBe(2010);
        expect(nextDate.month()).toBe(1);
        expect(nextDate.date()).toBe(28);

        // Same Time
        expect(nextDate.hour()).toBe(12);
        expect(nextDate.minute()).toBe(34);
        expect(nextDate.second()).toBe(43);
    });
});