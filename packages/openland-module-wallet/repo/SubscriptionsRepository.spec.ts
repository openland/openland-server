import { Store } from 'openland-module-db/FDB';
import { createNamedContext } from '@openland/context';
import { testEnvironmentStart, testEnvironmentEnd } from 'openland-modules/testEnvironment';
import { SubscriptionsRepository } from './SubscriptionsRepository';
import { PaymentsRepository } from './PaymentsRepository';
import { WalletRepository } from './WalletRepository';

const DAY = 24 * 60 * 60 * 1000;

describe('SubscriptionsRepository', () => {
    beforeAll(async () => {
        await testEnvironmentStart('subscriptions');
    }, 50000);
    afterAll(async () => {
        await testEnvironmentEnd();
    }, 50000);

    it('should expire if first period was not paid yet', async () => {
        let payments = new PaymentsRepository(Store);
        let wallet = new WalletRepository(Store);
        let subscriptions = new SubscriptionsRepository(Store, payments, wallet);
        subscriptions.setRouting({});
        payments.setRouting({});
        let ctx = createNamedContext('test');

        let now = Date.now();
        let subs = await subscriptions.createSubscription(ctx, 22, 100, 'month', { type: 'group', gid: 1 }, now);
        let id = subs.id;
        let firstPayment = (await Store.WalletSubscriptionPeriod.findById(ctx, id, 1))!.pid;
        expect(firstPayment).not.toBeNull();
        expect(subs.state).toBe('started');

        // Nothing should changed
        now += DAY;
        await subscriptions.doScheduling(ctx, id, now);
        subs = (await Store.WalletSubscription.findById(ctx, id))!;
        expect(subs.state).toBe('started');

        // Payment failing: No changes in first period
        await subscriptions.handlePaymentFailing(ctx, 22, id, 1, firstPayment!, now);
        subs = (await Store.WalletSubscription.findById(ctx, id))!;
        expect(subs.state).toBe('started');

        // Should expire
        now += 32 * DAY;
        await subscriptions.doScheduling(ctx, id, now);
        subs = (await Store.WalletSubscription.findById(ctx, id))!;
        expect(subs.state).toBe('expired');

        // Nothing to schedule after expired state
        await subscriptions.doScheduling(ctx, id, now);
        subs = (await Store.WalletSubscription.findById(ctx, id))!;
        expect(subs.state).toBe('expired');
    }, 50000);

    it('should implement grace period', async () => {
        let payments = new PaymentsRepository(Store);
        let wallet = new WalletRepository(Store);
        let subscriptions = new SubscriptionsRepository(Store, payments, wallet);
        subscriptions.setRouting({});
        payments.setRouting({});
        let ctx = createNamedContext('test');

        //
        // Just after creation of subscription it should create new single pending period with start 
        // at subscription start
        //
        let now = Date.now();
        let period1Now = now;
        let subs = await subscriptions.createSubscription(ctx, 24, 100, 'week', { type: 'group', gid: 1 }, now);
        let id = subs.id;
        let periodIndex = (await Store.WalletSubscriptionScheduling.findById(ctx, id))!.currentPeriodIndex;
        let period = (await Store.WalletSubscriptionPeriod.findById(ctx, id, periodIndex))!;
        expect(period.index).toBe(1);
        expect(period.state).toBe('pending');
        expect(period.pid).not.toBeNull();
        expect(period.start).toBe(now);
        expect(period.needCancel).toBeNull();
        expect(period.scheduledCancel).toBeNull();
        expect(subs.state).toBe('started');
        expect(subs.uid).toBe(24);
        expect(subs.amount).toBe(100);
        expect(subs.interval).toBe('week');

        // Payment success
        await expect(subscriptions.handlePaymentSuccess(ctx, 24, '', 'invalid', 1, period.pid!, now)).rejects.toThrowError('Unable to find subscription');
        await expect(subscriptions.handlePaymentSuccess(ctx, 25, '', id, 1, period.pid!, now)).rejects.toThrowError('Invalid UID');
        await subscriptions.handlePaymentSuccess(ctx, 24, '', id, 1, period.pid!, now);
        subs = (await Store.WalletSubscription.findById(ctx, id))!;
        periodIndex = (await Store.WalletSubscriptionScheduling.findById(ctx, id))!.currentPeriodIndex;
        period = (await Store.WalletSubscriptionPeriod.findById(ctx, id, periodIndex))!;
        expect(period.index).toBe(1);
        expect(period.state).toBe('success');
        expect(period.pid).not.toBeNull();
        expect(period.start).toBe(now);
        expect(period.needCancel).toBeNull();
        expect(period.scheduledCancel).toBeNull();
        expect(subs.state).toBe('started');
        expect(subs.uid).toBe(24);
        expect(subs.amount).toBe(100);
        expect(subs.interval).toBe('week');

        // Should keep started
        now += 8 * DAY;
        // Period should start exactly after 7 days after start of previous one
        // even when scheduling was perfomed later
        let periodNow = period1Now + 7 * DAY;
        await subscriptions.doScheduling(ctx, id, now);
        subs = (await Store.WalletSubscription.findById(ctx, id))!;
        periodIndex = (await Store.WalletSubscriptionScheduling.findById(ctx, id))!.currentPeriodIndex;
        period = (await Store.WalletSubscriptionPeriod.findById(ctx, id, periodIndex))!;
        expect(period.index).toBe(2);
        expect(period.state).toBe('pending');
        expect(period.pid).not.toBeNull();
        expect(period.start).toBe(periodNow);
        expect(period.needCancel).toBeNull();
        expect(period.scheduledCancel).toBeNull();
        expect(subs.state).toBe('started');
        expect(subs.uid).toBe(24);
        expect(subs.amount).toBe(100);
        expect(subs.interval).toBe('week');

        // First failing
        await subscriptions.handlePaymentFailing(ctx, 24, id, 2, period.pid!, now);
        subs = (await Store.WalletSubscription.findById(ctx, id))!;
        periodIndex = (await Store.WalletSubscriptionScheduling.findById(ctx, id))!.currentPeriodIndex;
        period = (await Store.WalletSubscriptionPeriod.findById(ctx, id, periodIndex))!;
        expect(period.index).toBe(2);
        expect(period.state).toBe('failing');
        expect(period.pid).not.toBeNull();
        expect(period.start).toBe(periodNow);
        expect(period.needCancel).toBeNull();
        expect(period.scheduledCancel).toBeNull();
        expect(subs.state).toBe('grace_period');
        expect(subs.uid).toBe(24);
        expect(subs.amount).toBe(100);
        expect(subs.interval).toBe('week');

        // Second failing
        await subscriptions.handlePaymentFailing(ctx, 24, id, 2, period.pid!, now);
        subs = (await Store.WalletSubscription.findById(ctx, id))!;
        periodIndex = (await Store.WalletSubscriptionScheduling.findById(ctx, id))!.currentPeriodIndex;
        period = (await Store.WalletSubscriptionPeriod.findById(ctx, id, periodIndex))!;
        expect(period.index).toBe(2);
        expect(period.state).toBe('failing');
        expect(period.pid).not.toBeNull();
        expect(period.start).toBe(periodNow);
        expect(period.needCancel).toBeNull();
        expect(period.scheduledCancel).toBeNull();
        expect(subs.state).toBe('grace_period');
        expect(subs.uid).toBe(24);
        expect(subs.amount).toBe(100);
        expect(subs.interval).toBe('week');

        // Recovered
        await subscriptions.handlePaymentSuccess(ctx, 24, '', id, 2, period.pid!, now);
        subs = (await Store.WalletSubscription.findById(ctx, id))!;
        periodIndex = (await Store.WalletSubscriptionScheduling.findById(ctx, id))!.currentPeriodIndex;
        period = (await Store.WalletSubscriptionPeriod.findById(ctx, id, periodIndex))!;
        expect(period.index).toBe(2);
        expect(period.state).toBe('success');
        expect(period.pid).not.toBeNull();
        expect(period.start).toBe(periodNow);
        expect(period.needCancel).toBeNull();
        expect(period.scheduledCancel).toBeNull();
        expect(subs.state).toBe('started');
        expect(subs.uid).toBe(24);
        expect(subs.amount).toBe(100);
        expect(subs.interval).toBe('week');

        // Day before period end
        now += 6 * DAY + DAY / 2;
        await subscriptions.doScheduling(ctx, id, now);
        subs = (await Store.WalletSubscription.findById(ctx, id))!;
        periodIndex = (await Store.WalletSubscriptionScheduling.findById(ctx, id))!.currentPeriodIndex;
        period = (await Store.WalletSubscriptionPeriod.findById(ctx, id, periodIndex))!;
        expect(period.index).toBe(3);
        expect(period.state).toBe('pending');
        expect(period.pid).not.toBeNull();
        expect(period.start).toBe(periodNow + DAY * 7);
        expect(period.needCancel).toBeNull();
        expect(period.scheduledCancel).toBeNull();
        expect(subs.state).toBe('started');
        expect(subs.uid).toBe(24);
        expect(subs.amount).toBe(100);
        expect(subs.interval).toBe('week');

        // Cancel subscription
        expect(await subscriptions.tryCancelSubscription(ctx, id)).toBe(true);
        subs = (await Store.WalletSubscription.findById(ctx, id))!;
        periodIndex = (await Store.WalletSubscriptionScheduling.findById(ctx, id))!.currentPeriodIndex;
        period = (await Store.WalletSubscriptionPeriod.findById(ctx, id, periodIndex))!;
        expect(period.index).toBe(3);
        expect(period.state).toBe('pending');
        expect(period.pid).not.toBeNull();
        expect(period.start).toBe(periodNow + DAY * 7);
        expect(period.needCancel).toBeNull();
        expect(period.scheduledCancel).toBeNull();
        expect(subs.state).toBe('canceled');
        expect(subs.uid).toBe(24);
        expect(subs.amount).toBe(100);
        expect(subs.interval).toBe('week');

        // Pay Last Period
        now += 6 * DAY;
        await subscriptions.doScheduling(ctx, id, now);
        await subscriptions.handlePaymentSuccess(ctx, 24, '', id, 3, period.pid!, now);
        subs = (await Store.WalletSubscription.findById(ctx, id))!;
        periodIndex = (await Store.WalletSubscriptionScheduling.findById(ctx, id))!.currentPeriodIndex;
        period = (await Store.WalletSubscriptionPeriod.findById(ctx, id, periodIndex))!;
        expect(period.index).toBe(3);
        expect(period.state).toBe('success');
        expect(period.pid).not.toBeNull();
        expect(period.start).toBe(periodNow + DAY * 7);
        expect(period.needCancel).toBeNull();
        expect(period.scheduledCancel).toBeNull();
        expect(subs.state).toBe('canceled');
        expect(subs.uid).toBe(24);
        expect(subs.amount).toBe(100);
        expect(subs.interval).toBe('week');

        now += 1 * DAY;
        await subscriptions.doScheduling(ctx, id, now);
        subs = (await Store.WalletSubscription.findById(ctx, id))!;
        periodIndex = (await Store.WalletSubscriptionScheduling.findById(ctx, id))!.currentPeriodIndex;
        period = (await Store.WalletSubscriptionPeriod.findById(ctx, id, periodIndex))!;
        expect(period.index).toBe(3);
        expect(period.state).toBe('success');
        expect(period.pid).not.toBeNull();
        expect(period.start).toBe(periodNow + DAY * 7);
        expect(period.needCancel).toBeNull();
        expect(period.scheduledCancel).toBeNull();
        expect(subs.state).toBe('expired');
        expect(subs.uid).toBe(24);
        expect(subs.amount).toBe(100);
        expect(subs.interval).toBe('week');
    }, 50000);

    it('should implement retrying period', async () => {
        let payments = new PaymentsRepository(Store);
        let wallet = new WalletRepository(Store);
        let subscriptions = new SubscriptionsRepository(Store, payments, wallet);
        subscriptions.setRouting({});
        payments.setRouting({});
        let ctx = createNamedContext('test');

        // New subscription with successful first payment
        let now = Date.now();
        let period1Now = now;
        let subs = await subscriptions.createSubscription(ctx, 25, 100, 'week', { type: 'group', gid: 1 }, now);
        let id = subs.id;
        let periodIndex = (await Store.WalletSubscriptionScheduling.findById(ctx, id))!.currentPeriodIndex;
        let period = (await Store.WalletSubscriptionPeriod.findById(ctx, id, periodIndex))!;
        await subscriptions.handlePaymentSuccess(ctx, 25, '', id, 1, period.pid!, now);

        now += 8 * DAY;
        let periodNow = period1Now + 7 * DAY;

        // Trigger next period
        await subscriptions.doScheduling(ctx, id, now);
        subs = (await Store.WalletSubscription.findById(ctx, id))!;
        periodIndex = (await Store.WalletSubscriptionScheduling.findById(ctx, id))!.currentPeriodIndex;
        period = (await Store.WalletSubscriptionPeriod.findById(ctx, id, periodIndex))!;

        // Fail payment
        await subscriptions.handlePaymentFailing(ctx, 25, id, 2, period.pid!, now);
        subs = (await Store.WalletSubscription.findById(ctx, id))!;
        periodIndex = (await Store.WalletSubscriptionScheduling.findById(ctx, id))!.currentPeriodIndex;
        period = (await Store.WalletSubscriptionPeriod.findById(ctx, id, periodIndex))!;
        expect(period.index).toBe(2);
        expect(period.state).toBe('failing');
        expect(period.pid).not.toBeNull();
        expect(period.start).toBe(periodNow);
        expect(period.needCancel).toBeNull();
        expect(period.scheduledCancel).toBeNull();
        expect(subs.state).toBe('grace_period');
        expect(subs.uid).toBe(25);
        expect(subs.amount).toBe(100);
        expect(subs.interval).toBe('week');

        // Should still be in grace period
        now += 5 * DAY;
        await subscriptions.doScheduling(ctx, id, now);
        subs = (await Store.WalletSubscription.findById(ctx, id))!;
        periodIndex = (await Store.WalletSubscriptionScheduling.findById(ctx, id))!.currentPeriodIndex;
        period = (await Store.WalletSubscriptionPeriod.findById(ctx, id, periodIndex))!;
        expect(period.index).toBe(2);
        expect(period.state).toBe('failing');
        expect(period.pid).not.toBeNull();
        expect(period.start).toBe(periodNow);
        expect(period.needCancel).toBeNull();
        expect(period.scheduledCancel).toBeNull();
        expect(subs.state).toBe('grace_period');
        expect(subs.uid).toBe(25);
        expect(subs.amount).toBe(100);
        expect(subs.interval).toBe('week');

        // Should expire grace period
        now += 6 * DAY;
        await subscriptions.doScheduling(ctx, id, now);
        subs = (await Store.WalletSubscription.findById(ctx, id))!;
        periodIndex = (await Store.WalletSubscriptionScheduling.findById(ctx, id))!.currentPeriodIndex;
        period = (await Store.WalletSubscriptionPeriod.findById(ctx, id, periodIndex))!;
        expect(period.index).toBe(2);
        expect(period.state).toBe('failing');
        expect(period.pid).not.toBeNull();
        expect(period.start).toBe(periodNow);
        expect(period.needCancel).toBeNull();
        expect(period.scheduledCancel).toBeNull();
        expect(subs.state).toBe('retrying');
        expect(subs.uid).toBe(25);
        expect(subs.amount).toBe(100);
        expect(subs.interval).toBe('week');

        // Should not be able to cancel directly in retrying state
        expect(await subscriptions.tryCancelSubscription(ctx, id)).toBe(false);

        // Should not expire subscription
        now += 40 * DAY;
        await subscriptions.doScheduling(ctx, id, now);
        subs = (await Store.WalletSubscription.findById(ctx, id))!;
        periodIndex = (await Store.WalletSubscriptionScheduling.findById(ctx, id))!.currentPeriodIndex;
        period = (await Store.WalletSubscriptionPeriod.findById(ctx, id, periodIndex))!;
        expect(period.index).toBe(2);
        expect(period.state).toBe('failing');
        expect(period.pid).not.toBeNull();
        expect(period.start).toBe(periodNow);
        expect(period.needCancel).toBeNull();
        expect(period.scheduledCancel).toBeNull();
        expect(subs.state).toBe('retrying');
        expect(subs.uid).toBe(25);
        expect(subs.amount).toBe(100);
        expect(subs.interval).toBe('week');

        // Should not be able to cancel directly in retrying state
        expect(await subscriptions.tryCancelSubscription(ctx, id)).toBe(false);

        // Should schedule subscription canceling
        now += 10 * DAY;
        await subscriptions.doScheduling(ctx, id, now);
        subs = (await Store.WalletSubscription.findById(ctx, id))!;
        periodIndex = (await Store.WalletSubscriptionScheduling.findById(ctx, id))!.currentPeriodIndex;
        period = (await Store.WalletSubscriptionPeriod.findById(ctx, id, periodIndex))!;
        expect(period.index).toBe(2);
        expect(period.state).toBe('failing');
        expect(period.pid).not.toBeNull();
        expect(period.start).toBe(periodNow);
        expect(period.needCancel).toBe(true);
        expect(period.scheduledCancel).toBeNull();
        expect(subs.state).toBe('retrying');
        expect(subs.uid).toBe(25);
        expect(subs.amount).toBe(100);
        expect(subs.interval).toBe('week');

        // Should not be able to cancel directly in retrying state
        expect(await subscriptions.tryCancelSubscription(ctx, id)).toBe(false);

        // Should expire after canceled payment
        await subscriptions.handlePaymentCanceled(ctx, 25, id, 2, period.pid!, now);
        subs = (await Store.WalletSubscription.findById(ctx, id))!;
        periodIndex = (await Store.WalletSubscriptionScheduling.findById(ctx, id))!.currentPeriodIndex;
        period = (await Store.WalletSubscriptionPeriod.findById(ctx, id, periodIndex))!;
        expect(period.index).toBe(2);
        expect(period.state).toBe('canceled');
        expect(period.pid).not.toBeNull();
        expect(period.start).toBe(periodNow);
        expect(period.needCancel).toBe(true);
        expect(period.scheduledCancel).toBeNull();
        expect(subs.state).toBe('expired');
        expect(subs.uid).toBe(25);
        expect(subs.amount).toBe(100);
        expect(subs.interval).toBe('week');

        // Should throw exception after expiring subscription
        await expect(subscriptions.handlePaymentCanceled(ctx, 25, id, 2, period.pid!, now)).rejects.toThrowError('Period is already in canceled state');
        await expect(subscriptions.handlePaymentSuccess(ctx, 25, '', id, 2, period.pid!, now)).rejects.toThrowError('Period is already in canceled state');
        await expect(subscriptions.handlePaymentFailing(ctx, 25, id, 2, period.pid!, now)).rejects.toThrowError('Period is already in canceled state');

        // Should cancel after expiring subscription
        expect(await subscriptions.tryCancelSubscription(ctx, id)).toBe(true);
    }, 50000);
});