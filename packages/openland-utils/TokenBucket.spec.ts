import { delay } from 'openland-utils/timer';
import { TokenBucket } from './TokenBucket';
describe('TokenBucket', () => {
    it('should lock if tokens are are available', async () => {
        let bucket = new TokenBucket({
            maxTokens: 10,
            refillDelay: 1000,
            refillAmount: 1
        });
        expect(bucket.availableTokens).toBe(10);
        expect(bucket.tryTake()).toBe(true);
        expect(bucket.availableTokens).toBe(9);
        expect(bucket.tryTake(10)).toBe(false);
        expect(bucket.availableTokens).toBe(9);
        await delay(2000);
        expect(bucket.availableTokens).toBe(10);
        expect(bucket.tryTake(10)).toBe(true);
        expect(bucket.availableTokens).toBe(0);
        await delay(1500);
        expect(bucket.availableTokens).toBe(1);
    });

    it('should refill right amount', async () => {
        let bucket = new TokenBucket({
            maxTokens: 10,
            refillDelay: 1000,
            refillAmount: 2
        });
        expect(bucket.tryTake(10)).toBe(true);
        expect(bucket.availableTokens).toBe(0);
        await delay(1500);
        expect(bucket.availableTokens).toBe(2);
    });
});