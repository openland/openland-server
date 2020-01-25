import { inTx } from '@openland/foundationdb';
import { PaymentsRepository } from './PaymentsRepository';
import { Store } from 'openland-module-db/FDB';
import { createNamedContext } from '@openland/context';
import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';

describe('PaymentsRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('payments');
    });
    afterAll(async () => {
        await testEnvironmentEnd();
    });

    it('should throw exception if user or profile does not exists', async () => {
        let repo = new PaymentsRepository(Store);
        let ctx = createNamedContext('test');
        await expect(repo.enablePayments(ctx, 10)).rejects.toThrowError('Unable to find user');
        await inTx(ctx, async (ctx2) => {
            await Store.User.create(ctx2, 10, { authId: 'auth-1', email: 'email@example.com', isBot: false, status: 'activated' });
        });
        await expect(repo.enablePayments(ctx, 10)).rejects.toThrowError('Unable to enable payments without profile');
        await inTx(ctx, async (ctx2) => {
            await Store.UserProfile.create(ctx2, 10, { firstName: 'name' });
        });
        await repo.enablePayments(ctx, 10);
    });

    it('should throw exception when customer is not set', async () => {
        let repo = new PaymentsRepository(Store);
        let ctx = createNamedContext('test');

        await expect(repo.getCustomerId(ctx, 1)).rejects.toThrowError('Unable to find customer');
        await inTx(ctx, async (ctx2) => {
            await Store.User.create(ctx2, 1, { authId: 'auth-2', email: 'email2@example.com', isBot: false, status: 'activated' });
            await Store.UserProfile.create(ctx2, 1, { firstName: 'name' });
            await repo.enablePayments(ctx2, 1);
        });
        await expect(repo.getCustomerId(ctx, 1)).rejects.toThrowError('Unable to find customer');
    });

    it('should resolve customer id', async () => {
        let repo = new PaymentsRepository(Store);
        let ctx = createNamedContext('test');

        await inTx(ctx, async (ctx2) => {
            await Store.User.create(ctx2, 3, { authId: 'auth-3', email: 'email3@example.com', isBot: false, status: 'activated' });
            await Store.UserProfile.create(ctx2, 3, { firstName: 'name' });
            await repo.enablePayments(ctx2, 3);
        });
        await repo.applyCustomerId(ctx, 3, 'customer-id-test');
        await expect(repo.getCustomerId(ctx, 3)).resolves.toBe('customer-id-test');
    });

    it('should not ovewrite customer id', async () => {

        let repo = new PaymentsRepository(Store);
        let ctx = createNamedContext('test');

        await inTx(ctx, async (ctx2) => {
            await Store.User.create(ctx2, 5, { authId: 'auth-5', email: 'email5@example.com', isBot: false, status: 'activated' });
            await Store.UserProfile.create(ctx2, 5, { firstName: 'name' });
            await repo.enablePayments(ctx2, 5);
        });

        await repo.applyCustomerId(ctx, 5, 'customer-id-test-2');
        await expect(repo.getCustomerId(ctx, 5)).resolves.toBe('customer-id-test-2');

        await repo.applyCustomerId(ctx, 5, 'customer-id-test-3');
        await expect(repo.getCustomerId(ctx, 5)).resolves.toBe('customer-id-test-2');
    });

    it('should register payment intent', async () => {
        let repo = new PaymentsRepository(Store);
        let ctx = createNamedContext('test');

        let res = await repo.registerPaymentIntent(ctx, 'paymentintent1', 100, { type: 'deposit', uid: 1 });
        expect(res.id).toBe('paymentintent1');
        expect(res.amount).toBe(100);
        expect(res.operation.type).toBe('deposit');
        expect((res.operation as any).uid).toBe(1);

        // Same PaymentIntent ID
        await expect(repo.registerPaymentIntent(ctx, 'paymentintent1', 100, { type: 'deposit', uid: 1 })).rejects.toThrowError();

        // Float amount
        await expect(repo.registerPaymentIntent(ctx, 'paymentintent2', 100.1, { type: 'deposit', uid: 1 })).rejects.toThrowError('Number 100.1 is not a safe integer');

        // Negative amount
        await expect(repo.registerPaymentIntent(ctx, 'paymentintent2', -100, { type: 'deposit', uid: 1 })).rejects.toThrowError('amount must be positive integer');
    });
});