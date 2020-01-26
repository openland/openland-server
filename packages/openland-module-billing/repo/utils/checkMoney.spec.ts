import { checkMoney } from './checkMoney';

describe('checkMoney', () => {
    it('should throw for invalid values', () => {
        expect(() => checkMoney(0)).toThrowError();
        expect(() => checkMoney(-1)).toThrowError();
        expect(() => checkMoney(0 / 0)).toThrowError();
        expect(() => checkMoney(-0)).toThrowError();
        expect(() => checkMoney(10000000000000000)).toThrowError();
    });
});