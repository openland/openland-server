import { getBudget } from './getBudget';

describe('getBudget', () => {
    it('should resolve single producer and consumer', () => {
        expect(getBudget({ producers: 1, consumers: 1 })).toBe(3);
        expect(getBudget({ producers: 1, consumers: 0 })).toBe(1);
        expect(getBudget({ producers: 0, consumers: 1 })).toBe(1);
        expect(getBudget({ producers: 0, consumers: 0 })).toBe(0);
    });
    it('should resolve multiple producers and consumers', () => {
        expect(getBudget({ producers: 5, consumers: 10 })).toBe(65);
    });
});