import { paymentAmounts } from './paymentAmounts';

describe('paymentAmounts', () => {
    it('should maintain minimum charge amount', () => {
        expect(() => paymentAmounts(0, 0)).toThrowError();
        expect(() => paymentAmounts(0, 10)).toThrowError();
        expect(() => paymentAmounts(-0, 0)).toThrowError();
        expect(() => paymentAmounts(-0, 10)).toThrowError();
        expect(() => paymentAmounts(0, -0)).toThrowError();
        expect(() => paymentAmounts(0, -10)).toThrowError();

        // Minimum charge
        let res = paymentAmounts(0, 100);
        expect(res.charge).toBe(100);
        expect(res.wallet).toBe(0);

        // Balance charge
        res = paymentAmounts(100, 100);
        expect(res.wallet).toBe(100);
        expect(res.charge).toBe(0);

        // Not enougth on balance to minimum charge - ignore balance
        res = paymentAmounts(90, 100);
        expect(res.wallet).toBe(0);
        expect(res.charge).toBe(100);

        // Normal balance charge
        res = paymentAmounts(190, 100);
        expect(res.wallet).toBe(100);
        expect(res.charge).toBe(0);
    });
});