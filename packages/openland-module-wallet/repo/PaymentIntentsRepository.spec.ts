import { inReadOnlyTx, inTx } from '@openland/foundationdb';
import { PaymentIntentsRepository } from './PaymentIntentsRepository';
import { Store } from 'openland-module-db/FDB';
import { createNamedContext } from '@openland/context';
import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';

let rootCtx = createNamedContext('test');

describe('PaymentIntentsRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('payments');
    });
    afterAll(async () => {
        await testEnvironmentEnd();
    });

    it('should enable payments when required conditions are met', async () => {
        let repo = new PaymentIntentsRepository(Store);
        repo.setRouting({});

        // No user
        await expect(repo.enablePayments(rootCtx, 10)).rejects.toThrowError('Unable to find user');

        // No profile
        await inTx(rootCtx, async (ctx2) => {
            await Store.User.create(ctx2, 10, { authId: 'auth-1', email: 'email@example.com', isBot: false, status: 'activated' });
        });
        await expect(repo.enablePayments(rootCtx, 10)).rejects.toThrowError('Unable to enable payments without profile');

        // All met
        await inTx(rootCtx, async (ctx2) => {
            await Store.UserProfile.create(ctx2, 10, { firstName: 'name' });
        });
        await repo.enablePayments(rootCtx, 10);

        // Throw error on double enable
        await expect(repo.enablePayments(rootCtx, 10)).rejects.toThrowError('Payments already enabled for user');
    });

    it('should throw exception when customer is not set', async () => {
        let repo = new PaymentIntentsRepository(Store);
        repo.setRouting({});

        await expect(repo.getCustomerId(rootCtx, 1)).rejects.toThrowError('Unable to find customer');
        await inTx(rootCtx, async (ctx2) => {
            await Store.User.create(ctx2, 1, { authId: 'auth-2', email: 'email2@example.com', isBot: false, status: 'activated' });
            await Store.UserProfile.create(ctx2, 1, { firstName: 'name' });
            await repo.enablePayments(ctx2, 1);
        });
        await expect(repo.getCustomerId(rootCtx, 1)).rejects.toThrowError('Unable to find customer');
    });

    it('should resolve customer id', async () => {
        let repo = new PaymentIntentsRepository(Store);
        repo.setRouting({});

        // Should throw if payments not enabled
        await expect(repo.applyCustomerId(rootCtx, 3, 'customer-id-test')).rejects.toThrowError('Unable to find customer');

        // Enable payments
        await inTx(rootCtx, async (ctx2) => {
            await Store.User.create(ctx2, 3, { authId: 'auth-3', email: 'email3@example.com', isBot: false, status: 'activated' });
            await Store.UserProfile.create(ctx2, 3, { firstName: 'name' });
            await repo.enablePayments(ctx2, 3);
        });
        await repo.applyCustomerId(rootCtx, 3, 'customer-id-test');

        // Should return same customer id
        await expect(repo.getCustomerId(rootCtx, 3)).resolves.toBe('customer-id-test');
    });

    it('should not ovewrite customer id', async () => {

        let repo = new PaymentIntentsRepository(Store);
        repo.setRouting({});

        await inTx(rootCtx, async (ctx2) => {
            await Store.User.create(ctx2, 5, { authId: 'auth-5', email: 'email5@example.com', isBot: false, status: 'activated' });
            await Store.UserProfile.create(ctx2, 5, { firstName: 'name' });
            await repo.enablePayments(ctx2, 5);
        });

        await repo.applyCustomerId(rootCtx, 5, 'customer-id-test-2');
        await expect(repo.getCustomerId(rootCtx, 5)).resolves.toBe('customer-id-test-2');

        await repo.applyCustomerId(rootCtx, 5, 'customer-id-test-3');
        await expect(repo.getCustomerId(rootCtx, 5)).resolves.toBe('customer-id-test-2');
    });

    it('should register payment intent', async () => {
        let repo = new PaymentIntentsRepository(Store);
        let onPaymentIntentFailing = jest.fn();
        let onPaymentIntentSuccess = jest.fn();
        let onPaymentIntentActionNeeded = jest.fn();
        let onPaymentIntentCanceled = jest.fn();
        repo.setRouting({
            onPaymentIntentNeedAction: onPaymentIntentActionNeeded,
            onPaymentIntentFailing: onPaymentIntentFailing,
            onPaymentIntentSuccess: onPaymentIntentSuccess,
            onPaymentIntentCanceled: onPaymentIntentCanceled
        });

        jest.clearAllMocks();
        let res = await repo.registerPaymentIntent(rootCtx, 'paymentintent1', 100, { type: 'deposit', uid: 1 });
        expect(res.id).toBe('paymentintent1');
        expect(res.amount).toBe(100);
        expect(res.operation.type).toBe('deposit');
        expect((res.operation as any).uid).toBe(1);
        expect(onPaymentIntentSuccess.mock.calls.length).toBe(0);
        expect(onPaymentIntentFailing.mock.calls.length).toBe(0);
        expect(onPaymentIntentActionNeeded.mock.calls.length).toBe(0);
        expect(onPaymentIntentCanceled.mock.calls.length).toBe(0);

        // Same PaymentIntent ID
        jest.clearAllMocks();
        await expect(repo.registerPaymentIntent(rootCtx, 'paymentintent1', 100, { type: 'deposit', uid: 1 })).rejects.toThrowError();
        expect(onPaymentIntentSuccess.mock.calls.length).toBe(0);
        expect(onPaymentIntentFailing.mock.calls.length).toBe(0);
        expect(onPaymentIntentActionNeeded.mock.calls.length).toBe(0);
        expect(onPaymentIntentCanceled.mock.calls.length).toBe(0);

        // Float amount
        jest.clearAllMocks();
        await expect(repo.registerPaymentIntent(rootCtx, 'paymentintent2', 100.1, { type: 'deposit', uid: 1 })).rejects.toThrowError();
        expect(onPaymentIntentSuccess.mock.calls.length).toBe(0);
        expect(onPaymentIntentFailing.mock.calls.length).toBe(0);
        expect(onPaymentIntentActionNeeded.mock.calls.length).toBe(0);
        expect(onPaymentIntentCanceled.mock.calls.length).toBe(0);

        // Negative amount
        jest.clearAllMocks();
        await expect(repo.registerPaymentIntent(rootCtx, 'paymentintent2', -100, { type: 'deposit', uid: 1 })).rejects.toThrowError();
        expect(onPaymentIntentSuccess.mock.calls.length).toBe(0);
        expect(onPaymentIntentFailing.mock.calls.length).toBe(0);
        expect(onPaymentIntentActionNeeded.mock.calls.length).toBe(0);
        expect(onPaymentIntentCanceled.mock.calls.length).toBe(0);

        // Failing
        jest.clearAllMocks();
        await repo.paymentIntentFailing(rootCtx, 'paymentintent1');
        expect(onPaymentIntentSuccess.mock.calls.length).toBe(0);
        expect(onPaymentIntentFailing.mock.calls.length).toBe(1);
        expect(onPaymentIntentActionNeeded.mock.calls.length).toBe(0);
        expect(onPaymentIntentCanceled.mock.calls.length).toBe(0);

        // Action Needed
        jest.clearAllMocks();
        await repo.paymentIntentNeedAction(rootCtx, 'paymentintent1');
        expect(onPaymentIntentSuccess.mock.calls.length).toBe(0);
        expect(onPaymentIntentFailing.mock.calls.length).toBe(0);
        expect(onPaymentIntentActionNeeded.mock.calls.length).toBe(1);
        expect(onPaymentIntentCanceled.mock.calls.length).toBe(0);

        // Failing after Action Needed
        jest.clearAllMocks();
        await repo.paymentIntentFailing(rootCtx, 'paymentintent1');
        expect(onPaymentIntentSuccess.mock.calls.length).toBe(0);
        expect(onPaymentIntentFailing.mock.calls.length).toBe(1);
        expect(onPaymentIntentActionNeeded.mock.calls.length).toBe(0);
        expect(onPaymentIntentCanceled.mock.calls.length).toBe(0);

        // Success
        jest.clearAllMocks();
        await repo.paymentIntentSuccess(rootCtx, 'paymentintent1');
        expect(onPaymentIntentSuccess.mock.calls.length).toBe(1);
        expect(onPaymentIntentFailing.mock.calls.length).toBe(0);
        expect(onPaymentIntentActionNeeded.mock.calls.length).toBe(0);
        expect(onPaymentIntentCanceled.mock.calls.length).toBe(0);

        // Double Success
        jest.clearAllMocks();
        await repo.paymentIntentSuccess(rootCtx, 'paymentintent1');
        expect(onPaymentIntentSuccess.mock.calls.length).toBe(0);
        expect(onPaymentIntentFailing.mock.calls.length).toBe(0);
        expect(onPaymentIntentActionNeeded.mock.calls.length).toBe(0);
        expect(onPaymentIntentCanceled.mock.calls.length).toBe(0);

        // Cancel after success
        jest.clearAllMocks();
        await repo.paymentIntentCancel(rootCtx, 'paymentintent1');
        expect(onPaymentIntentSuccess.mock.calls.length).toBe(0);
        expect(onPaymentIntentFailing.mock.calls.length).toBe(0);
        expect(onPaymentIntentActionNeeded.mock.calls.length).toBe(0);
        expect(onPaymentIntentCanceled.mock.calls.length).toBe(0);

        // Failing after complete
        jest.clearAllMocks();
        await repo.paymentIntentFailing(rootCtx, 'paymentintent1');
        expect(onPaymentIntentSuccess.mock.calls.length).toBe(0);
        expect(onPaymentIntentFailing.mock.calls.length).toBe(0);
        expect(onPaymentIntentActionNeeded.mock.calls.length).toBe(0);
        expect(onPaymentIntentCanceled.mock.calls.length).toBe(0);

        // Action needed after complete
        jest.clearAllMocks();
        await repo.paymentIntentNeedAction(rootCtx, 'paymentintent1');
        expect(onPaymentIntentSuccess.mock.calls.length).toBe(0);
        expect(onPaymentIntentFailing.mock.calls.length).toBe(0);
        expect(onPaymentIntentActionNeeded.mock.calls.length).toBe(0);
        expect(onPaymentIntentCanceled.mock.calls.length).toBe(0);

        // Unknown
        jest.clearAllMocks();
        await repo.paymentIntentSuccess(rootCtx, 'paymentintent1-invalid');
        expect(onPaymentIntentSuccess.mock.calls.length).toBe(0);
        expect(onPaymentIntentFailing.mock.calls.length).toBe(0);
        expect(onPaymentIntentActionNeeded.mock.calls.length).toBe(0);
        expect(onPaymentIntentCanceled.mock.calls.length).toBe(0);

        jest.clearAllMocks();
        await repo.paymentIntentCancel(rootCtx, 'paymentintent1-invalid');
        expect(onPaymentIntentSuccess.mock.calls.length).toBe(0);
        expect(onPaymentIntentFailing.mock.calls.length).toBe(0);
        expect(onPaymentIntentActionNeeded.mock.calls.length).toBe(0);
        expect(onPaymentIntentCanceled.mock.calls.length).toBe(0);

        // Canceling test
        res = await repo.registerPaymentIntent(rootCtx, 'paymentintent3', 100, { type: 'deposit', uid: 1 });
        expect(res.id).toBe('paymentintent3');
        expect(res.amount).toBe(100);
        expect(res.operation.type).toBe('deposit');
        expect((res.operation as any).uid).toBe(1);

        jest.clearAllMocks();
        await repo.paymentIntentCancel(rootCtx, 'paymentintent3');
        expect(onPaymentIntentSuccess.mock.calls.length).toBe(0);
        expect(onPaymentIntentFailing.mock.calls.length).toBe(0);
        expect(onPaymentIntentActionNeeded.mock.calls.length).toBe(0);
        expect(onPaymentIntentCanceled.mock.calls.length).toBe(1);

        jest.clearAllMocks();
        await repo.paymentIntentCancel(rootCtx, 'paymentintent3');
        expect(onPaymentIntentSuccess.mock.calls.length).toBe(0);
        expect(onPaymentIntentFailing.mock.calls.length).toBe(0);
        expect(onPaymentIntentActionNeeded.mock.calls.length).toBe(0);
        expect(onPaymentIntentCanceled.mock.calls.length).toBe(0);

        jest.clearAllMocks();
        await repo.paymentIntentSuccess(rootCtx, 'paymentintent3');
        expect(onPaymentIntentSuccess.mock.calls.length).toBe(0);
        expect(onPaymentIntentFailing.mock.calls.length).toBe(0);
        expect(onPaymentIntentActionNeeded.mock.calls.length).toBe(0);
        expect(onPaymentIntentCanceled.mock.calls.length).toBe(0);
    });

    it('should manage payment methods correctly', async () => {
        let repo = new PaymentIntentsRepository(Store);
        repo.setRouting({});

        // Non-card payment method
        await expect(repo.addPaymentMethod(rootCtx, 1, {
            id: 'pm_test'
        } as any)).rejects.toThrowError('Only cards are allowed');

        // Add payment method
        let res = await repo.addPaymentMethod(rootCtx, 1, {
            id: 'pm_test',
            card: {
                brand: 'Visa',
                country: 'US',
                exp_month: 10,
                exp_year: 2024,
                last4: '1234'
            }
        } as any);
        expect(res).toBe(true);

        // Double adding
        res = await repo.addPaymentMethod(rootCtx, 1, {
            id: 'pm_test',
            card: {
                brand: 'Visa',
                country: 'US',
                exp_month: 10,
                exp_year: 2024,
                last4: '1234'
            }
        } as any);
        expect(res).toBe(false);

        // Check data
        let card = (await inReadOnlyTx(rootCtx, async (ctx) => await Store.UserStripeCard.findById(ctx, 1, 'pm_test')))!;
        expect(card.brand).toBe('Visa');
        expect(card.country).toBe('US');
        expect(card.exp_month).toBe(10);
        expect(card.exp_year).toBe(2024);
        expect(card.last4).toBe('1234');
        expect(card.deleted).toBe(false);
        expect(card.stripeAttached).toBe(false);
        expect(card.stripeDetached).toBe(false);
        expect(card.uid).toBe(1);
        expect(card.default).toBe(true);

        // Second card
        res = await repo.addPaymentMethod(rootCtx, 1, {
            id: 'pm_test_2',
            card: {
                brand: 'Visa',
                country: 'US',
                exp_month: 10,
                exp_year: 2024,
                last4: '1234'
            }
        } as any);
        expect(res).toBe(true);
        card = (await inReadOnlyTx(rootCtx, async (ctx) => await Store.UserStripeCard.findById(ctx, 1, 'pm_test_2')))!;
        expect(card.brand).toBe('Visa');
        expect(card.country).toBe('US');
        expect(card.exp_month).toBe(10);
        expect(card.exp_year).toBe(2024);
        expect(card.last4).toBe('1234');
        expect(card.deleted).toBe(false);
        expect(card.stripeAttached).toBe(false);
        expect(card.stripeDetached).toBe(false);
        expect(card.uid).toBe(1);
        expect(card.default).toBe(false);

        // Make Default
        res = await repo.makePaymentMethodDefault(rootCtx, 1, 'pm_test_2');
        expect(res).toBe(true);

        // Make default second time
        res = await repo.makePaymentMethodDefault(rootCtx, 1, 'pm_test_2');
        expect(res).toBe(false);

        // Try to make default invalid card
        await expect(repo.makePaymentMethodDefault(rootCtx, 1, 'pm_test_invalid')).rejects.toThrowError('Card not found');

        // Try to remove invalid payment method
        await expect(repo.removePaymentMethod(rootCtx, 1, 'pm_test_invalid')).rejects.toThrowError('Card not found');

        // Check that card is default
        card = (await inReadOnlyTx(rootCtx, async (ctx) => await Store.UserStripeCard.findById(ctx, 1, 'pm_test_2')))!;
        expect(card.brand).toBe('Visa');
        expect(card.country).toBe('US');
        expect(card.exp_month).toBe(10);
        expect(card.exp_year).toBe(2024);
        expect(card.last4).toBe('1234');
        expect(card.deleted).toBe(false);
        expect(card.stripeAttached).toBe(false);
        expect(card.stripeDetached).toBe(false);
        expect(card.uid).toBe(1);
        expect(card.default).toBe(true);

        // Third card
        res = await repo.addPaymentMethod(rootCtx, 1, {
            id: 'pm_test_3',
            card: {
                brand: 'Visa',
                country: 'US',
                exp_month: 10,
                exp_year: 2024,
                last4: '1234'
            }
        } as any);
        expect(res).toBe(true);
        card = (await inReadOnlyTx(rootCtx, async (ctx) => await Store.UserStripeCard.findById(ctx, 1, 'pm_test_3')))!;
        expect(card.brand).toBe('Visa');
        expect(card.country).toBe('US');
        expect(card.exp_month).toBe(10);
        expect(card.exp_year).toBe(2024);
        expect(card.last4).toBe('1234');
        expect(card.deleted).toBe(false);
        expect(card.stripeAttached).toBe(false);
        expect(card.stripeDetached).toBe(false);
        expect(card.uid).toBe(1);
        expect(card.default).toBe(false);

        // Remove default card
        res = await repo.removePaymentMethod(rootCtx, 1, 'pm_test_2');
        expect(res).toBe(true);
        res = await repo.removePaymentMethod(rootCtx, 1, 'pm_test_2');
        expect(res).toBe(false);
        card = (await inReadOnlyTx(rootCtx, async (ctx) => await Store.UserStripeCard.findById(ctx, 1, 'pm_test_2')))!;
        expect(card.deleted).toBe(true);
        expect(card.stripeDetached).toBe(false);

        // Remove third card
        res = await repo.removePaymentMethod(rootCtx, 1, 'pm_test_3');
        expect(res).toBe(true);
        res = await repo.removePaymentMethod(rootCtx, 1, 'pm_test_3');
        expect(res).toBe(false);

        // First card became default
        card = (await inReadOnlyTx(rootCtx, async (ctx) => await Store.UserStripeCard.findById(ctx, 1, 'pm_test')))!;
        expect(card.default).toBe(true);

        // Remove first card
        res = await repo.removePaymentMethod(rootCtx, 1, 'pm_test');
        expect(res).toBe(true);
        res = await repo.removePaymentMethod(rootCtx, 1, 'pm_test');
        expect(res).toBe(false);
    });
});