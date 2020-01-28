import { Store } from 'openland-module-db/FDB';
import { createNamedContext } from '@openland/context';
import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { SubscriptionsRepository } from './SubscriptionsRepository';
import { PaymentsAsyncRepository } from './PaymentsAsyncRepository';
import { WalletRepository } from './WalletRepository';

const DAY = 24 * 60 * 60 * 1000;

describe('SubscriptionsRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('subscriptions');
    });
    afterAll(async () => {
        await testEnvironmentEnd();
    });

    it('should create subscription, process payment and recover during grace period', async () => {
        let payments = new PaymentsAsyncRepository(Store);
        let wallet = new WalletRepository(Store);
        let subscriptions = new SubscriptionsRepository(Store, payments, wallet);
        payments.setRouting({});
        subscriptions.setRouting({});
        let ctx = createNamedContext('test');
        let subs = await subscriptions.createSubscription(ctx, 1, 100, 'month', { type: 'group', gid: 1 });

        expect(subs.uid).toBe(1);
        expect(subs.state).toBe('started');
        expect(subs.interval).toBe('month');
        expect(subs.amount).toBe(100);

        // Initial scheduling
        let plan = await subscriptions.planScheduling(ctx, subs.id, Date.now());
        expect(plan).toBe('schedule');
        await subscriptions.scheduleNextPeriod(ctx, subs.id);

        // Next scheduling
        plan = await subscriptions.planScheduling(ctx, subs.id, Date.now());
        expect(plan).toBe('nothing');

        // First period
        let period = (await Store.WalletSubscriptionPeriod.findById(ctx, subs.id, 1))!;
        expect(period).not.toBeFalsy();
        expect(period.state).toBe('pending');

        // Fail first payment
        await subscriptions.handlePaymentFailing(ctx, 1, subs.id, 1);

        // Should enter grace period
        plan = await subscriptions.planScheduling(ctx, subs.id, Date.now());
        expect(plan).toBe('start_grace_period');
        await subscriptions.enterGracePeriod(ctx, 1, subs.id);
        subs = (await Store.WalletSubscription.findById(ctx, subs.id))!;
        expect(subs.state).toBe('grace_period');

        // Should not change anything for subsequent payments
        await subscriptions.handlePaymentFailing(ctx, 1, subs.id, 1);
        plan = await subscriptions.planScheduling(ctx, subs.id, Date.now());
        expect(plan).toBe('nothing');
        subs = (await Store.WalletSubscription.findById(ctx, subs.id))!;
        expect(subs.state).toBe('grace_period');

        // Should recover from grace period
        await subscriptions.handlePaymentSuccess(ctx, 1, subs.id, 1);
        subs = (await Store.WalletSubscription.findById(ctx, subs.id))!;
        expect(subs.state).toBe('started');
        let period2 = (await Store.WalletSubscriptionPeriod.findById(ctx, subs.id, 1))!;
        expect(period2.start).toBe(period.start); // Should not change start date

        // Should not try to schedule early
        plan = await subscriptions.planScheduling(ctx, subs.id, Date.now() + 17 * DAY);
        expect(plan).toBe('nothing');

        // Should schedule next period
        plan = await subscriptions.planScheduling(ctx, subs.id, Date.now() + 32 * DAY);
        expect(plan).toBe('schedule');
    });

    it('should schedule next payment if conditions met', async () => {
        let payments = new PaymentsAsyncRepository(Store);
        let wallet = new WalletRepository(Store);
        let subscriptions = new SubscriptionsRepository(Store, payments, wallet);
        subscriptions.setRouting({});
        payments.setRouting({});
        let ctx = createNamedContext('test');
        let subs = await subscriptions.createSubscription(ctx, 2, 100, 'month', { type: 'group', gid: 1 });

        // Normal scheduling
        await subscriptions.scheduleNextPeriod(ctx, subs.id);

        // Cancel subscription
        await subscriptions.cancelSubscription(ctx, subs.id);

        // Should not be able to schedule
        await expect(subscriptions.scheduleNextPeriod(ctx, subs.id)).rejects.toThrowError('Unable to extend subscription canceled subscription');
    });
});