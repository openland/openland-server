import { uuid } from 'openland-utils/uuid';
import { Context } from '@openland/context';
import { Store, WalletSubscriptionCreateShape } from '../../openland-module-db/store';
import { inTx } from '@openland/foundationdb';
import { PaymentsRepository } from './PaymentsRepository';
import { nextRenewMonthly } from './utils/nextRenewMonthly';
import { RoutingRepository } from './RoutingRepository';
import { WalletRepository } from './WalletRepository';
import { paymentAmounts } from './utils/paymentAmounts';
import { NotFoundError } from 'openland-errors/NotFoundError';

const DAY = 24 * 60 * 60 * 1000; // ms in day

const WEEK = 7 * DAY; // ms in week

function endDate(interval: 'week' | 'month', start: number) {
    return interval === 'week' ? start + WEEK : nextRenewMonthly(start);
}

export class SubscriptionsRepository {
    readonly store: Store;
    readonly payments: PaymentsRepository;
    readonly wallet: WalletRepository;
    private routing!: RoutingRepository;

    constructor(store: Store, payments: PaymentsRepository, wallet: WalletRepository) {
        this.store = store;
        this.payments = payments;
        this.wallet = wallet;
    }

    setRouting = (routing: RoutingRepository) => {
        this.routing = routing;
    }

    createSubscription = async (parent: Context, uid: number, amount: number, interval: 'week' | 'month', product: WalletSubscriptionCreateShape['proudct'], now: number) => {
        return await inTx(parent, async (ctx) => {

            // Create New Subscription
            let sid = uuid();
            let subscription = await this.store.WalletSubscription.create(ctx, sid, {
                uid: uid,
                amount: amount,
                interval: interval,
                start: now,
                state: 'started',
                proudct: product
            });

            // Init Scheduling
            await this.store.WalletSubscriptionScheduling.create(ctx, subscription.id, {
                currentPeriodIndex: 1
            });

            // First period
            await this.createPeriod(ctx, subscription.id, 1, subscription.uid, subscription.amount, subscription.start);

            // Notify about subscription start
            if (this.routing.onSubscriptionStarted) {
                await this.routing.onSubscriptionStarted(ctx, subscription.id);
            }

            return subscription;
        });
    }

    tryCancelSubscription = async (parent: Context, id: string) => {
        return await inTx(parent, async (ctx) => {
            let s = (await this.store.WalletSubscription.findById(ctx, id));
            if (!s) {
                throw Error('Unable to find subscription');
            }

            // If already expired
            if (s.state === 'expired' || s.state === 'canceled') {
                return true;
            }

            if (s.state === 'retrying') {
                return false;
            }

            //
            // Only two states are possible: grace_period and started.
            // In both cases subscription is active and current billing cycle is maintained
            //
            s.state = 'canceled';
            if (this.routing.onSubscriptionCanceled) {
                await this.routing.onSubscriptionCanceled(ctx, id);
            }

            return true;
        });
    }

    //
    // Subscription Scheduling
    //

    doScheduling = async (parent: Context, id: string, now: number) => {
        await inTx(parent, async (ctx) => {

            let subscription = (await this.store.WalletSubscription.findById(ctx, id))!;
            let scheduling = await this.store.WalletSubscriptionScheduling.findById(ctx, id);
            if (!scheduling) {
                throw Error('Scheduling is not inited!');
            }

            // Check current period state
            let period = (await this.store.WalletSubscriptionPeriod.findById(ctx, subscription.id, scheduling.currentPeriodIndex))!;

            // Expire subscription
            if (subscription.state === 'canceled') {
                let periodEnd = endDate(subscription.interval, period.start);
                if (now > periodEnd) {
                    subscription.state = 'expired';
                    if (this.routing.onSubscriptionExpired) {
                        await this.routing.onSubscriptionExpired(ctx, id);
                    }
                    return;
                }
            }

            // Nothing to schedule in expired state
            if (subscription.state === 'expired') {
                return;
            }

            // Check if grace period ended
            if (subscription.state === 'grace_period') {
                let gracePeriod = subscription.interval === 'week' ? (6 * DAY) : (16 * DAY);
                if (now > (gracePeriod + period.start)) {
                    subscription.state = 'retrying';
                    if (this.routing.onSubscriptionPaused) {
                        await this.routing.onSubscriptionPaused(ctx, id);
                    }
                    return;
                }
            }

            // Check if payment should be canceled
            if (subscription.state === 'retrying') {
                if (now - period.start > (60 * DAY) && !period.needCancel) {
                    period.needCancel = true;
                    return;
                }
            }

            // Check if next period should be scheduled
            if (subscription.state === 'started') {

                // Special case for first period
                if (scheduling.currentPeriodIndex === 1) {
                    if (period.state !== 'success') {
                        let periodEnd = endDate(subscription.interval, period.start);
                        if (now > periodEnd) {
                            subscription.state = 'expired';
                            if (this.routing.onSubscriptionExpired) {
                                await this.routing.onSubscriptionExpired(ctx, id);
                            }
                        }
                        return;
                    }
                }

                // Schedule ONE day BEFORE expiring current subscription
                let scheduleNextTime = endDate(subscription.interval, period.start) - DAY;
                if (now > scheduleNextTime) {
                    await this.scheduleNextPeriod(ctx, id);
                    return;
                }
            }
        });
    }

    private scheduleNextPeriod = async (parent: Context, id: string) => {
        await inTx(parent, async (ctx) => {

            const subscription = (await this.store.WalletSubscription.findById(ctx, id))!;

            // Subscription state check
            if (subscription.state === 'canceled') {
                throw Error('Unable to extend subscription canceled subscription');
            }
            if (subscription.state === 'expired') {
                throw Error('Unable to extend subscription expired subscription');
            }
            if (subscription.state === 'grace_period') {
                throw Error('Unable to extend subscription in grace period');
            }
            if (subscription.state === 'retrying') {
                throw Error('Unable to extend subscription in retrying period');
            }

            // Calculagte scheduling parameters
            let scheduling = await this.store.WalletSubscriptionScheduling.findById(ctx, subscription.id);
            if (!scheduling) {
                throw Error('Scheduling is not inited!');
            }
            let period = (await this.store.WalletSubscriptionPeriod.findById(ctx, subscription.id, scheduling.currentPeriodIndex))!;
            if (period.state !== 'success') {
                throw Error('Unable to extend subscription when previous period is not in success state');
            }
            scheduling.currentPeriodIndex++;
            let nextPeriodStart = endDate(subscription.interval, period.start);
            let index = scheduling.currentPeriodIndex;
            let start = nextPeriodStart;

            await this.createPeriod(ctx, subscription.id, index, subscription.uid, subscription.amount, start);
        });
    }

    private createPeriod = async (parent: Context, id: string, index: number, uid: number, amount: number, start: number) => {
        await inTx(parent, async (ctx) => {
            // Wallet transaction
            let walletBalance = await this.wallet.getAvailableBalance(ctx, uid);
            let amounts = paymentAmounts(walletBalance, amount);

            if (amounts.charge === 0) {

                // Charge from balance
                await this.wallet.subscriptionBalance(ctx, uid, amounts.wallet, id, index);

                // Create Period
                await this.store.WalletSubscriptionPeriod.create(ctx, id, index, {
                    pid: null,
                    start: start,
                    state: 'success'
                });

                // Notify about successful payment
                if (this.routing.onSubscriptionPaymentSuccess) {
                    await this.routing.onSubscriptionPaymentSuccess(ctx, id, index);
                }
            } else {

                // Register subscription payment
                let wallet = await this.wallet.subscriptionPayment(ctx, uid, amounts.wallet, amounts.charge, id, index);

                // Create Payment
                let pid = uuid();
                await this.payments.createPayment(ctx, pid, uid, amount, {
                    type: 'subscription',
                    uid: uid,
                    subscription: id,
                    period: index,
                    txid: wallet
                });

                // Create Period
                await this.store.WalletSubscriptionPeriod.create(ctx, id, index, {
                    pid: pid,
                    start: start,
                    state: 'pending'
                });
            }
        });
    }

    //
    // Payment Events
    //

    handlePaymentSuccess = async (parent: Context, uid: number, id: string, index: number, pid: string, now: number) => {
        await inTx(parent, async (ctx) => {
            let subscription = (await this.store.WalletSubscription.findById(ctx, id))!;
            if (!subscription) {
                throw Error('Unable to find subscription');
            }
            if (subscription.uid !== uid) {
                throw Error('Invalid UID');
            }
            let scheduling = (await this.store.WalletSubscriptionScheduling.findById(ctx, id))!;
            if (!scheduling) {
                throw Error('Invalid state');
            }

            // Just ignore if event is about invalid period
            if (scheduling.currentPeriodIndex !== index) {
                throw Error('Invalid payment');
            }

            // Update period state only when in pending state
            let period = (await this.store.WalletSubscriptionPeriod.findById(ctx, id, index))!;

            // Check payment
            if (period.pid !== pid) {
                throw Error('Invalid payment');
            }
            if (period.state === 'canceled') {
                throw Error('Period is already in canceled state');
            }
            if (period.state === 'success') {
                throw Error('Period is already in canceled state');
            }
            if (subscription.state === 'expired') {
                throw Error('Payment success when subscription already expired');
            }

            // Notify about successful payment
            let firstPayment = period.state === 'pending';
            period.state = 'success';
            if (subscription.state === 'retrying') {
                period.start = now; // Update start date if subscription in retrying state
            }
            if (this.routing.onSubscriptionPaymentSuccess) {
                await this.routing.onSubscriptionPaymentSuccess(ctx, subscription.id, period.index);
            }

            //
            // First payment attempt successful - nothing changed in subscription
            //
            if (firstPayment) {
                return;
            }

            //
            // Secondary payment attempt successful            
            //

            if (subscription.state === 'canceled') {
                // Nothing to do: subscription is canceled
                return;
            }

            if (subscription.state === 'started') {
                // Could possible only for first payment since first payment is not 
                // triggering grace period or retrying state
                if (index !== 1) {
                    throw Error('Internal state error');
                }
                return;
            }

            // Recover subscription
            if (subscription.state === 'grace_period') {

                // Mark subscription as started
                subscription.state = 'started';

                // Recover callback
                if (this.routing.onSubscriptionRecovered) {
                    await this.routing.onSubscriptionRecovered(ctx, subscription.id);
                }
                return;
            }

            // Subscription is restarted
            if (subscription.state === 'retrying') {

                // Mark subscription as started
                subscription.state = 'started';

                // Restart callback
                if (this.routing.onSubscriptionRestarted) {
                    await this.routing.onSubscriptionRestarted(ctx, subscription.id);
                }
                return;
            }

            throw Error('Invalid subscription state: ' + subscription.state);
        });
    }

    handlePaymentFailing = async (parent: Context, uid: number, id: string, index: number, pid: string, now: number) => {
        await inTx(parent, async (ctx) => {
            let subscription = (await this.store.WalletSubscription.findById(ctx, id))!;
            if (!subscription) {
                throw Error('Unable to find subscription');
            }
            if (subscription.uid !== uid) {
                throw Error('Invalid UID');
            }
            let scheduling = (await this.store.WalletSubscriptionScheduling.findById(ctx, id))!;
            if (!scheduling) {
                throw Error('Invalid state');
            }

            // Just ignore if event is about invalid period
            if (scheduling.currentPeriodIndex !== index) {
                throw Error('Invalid payment');
            }

            // Update period state only when in pending state
            let period = (await this.store.WalletSubscriptionPeriod.findById(ctx, id, index))!;

            // Check payment
            if (period.pid !== pid) {
                throw Error('Invalid payment');
            }
            if (period.state === 'canceled') {
                throw Error('Period is already in canceled state');
            }
            if (period.state === 'success') {
                throw Error('Period is already in canceled state');
            }
            if (subscription.state === 'expired') {
                throw Error('Payment success when subscription already expired');
            }

            if (period.state === 'pending') {
                period.state = 'failing';

                //
                // There are two different cases stopping subscription:
                // voluntary canceling and involuntary one.
                //
                // Involuntary canceling has grace period when user is able to recover
                // subscription by updating it's payment methods.
                //
                // If user cancel subscription there are no grace period and we 
                // expect commitment for full next billing cycle.
                // Once next billing cycle started user can only stop expanding
                // subscription, but his dept for last cycle must be settled.
                // Same true for the very first billing cycle.
                //
                // 
                // So when subscription in canceled state there are no grace period
                //

                // Do not trigger grace period for first period or canceled subscription
                if (index === 1 || subscription.state === 'canceled') {
                    return;
                }

                //
                // There are three possible states here - started, grace_period and retrying.
                // We are going
                //

                if (subscription.state === 'started') {
                    subscription.state = 'grace_period';
                    if (this.routing.onSubscriptionFailing) {
                        await this.routing.onSubscriptionFailing(ctx, subscription.id);
                    }
                }
            }
        });
    }

    handlePaymentCanceled = async (parent: Context, uid: number, id: string, index: number, pid: string, now: number) => {
        await inTx(parent, async (ctx) => {
            let subscription = (await this.store.WalletSubscription.findById(ctx, id))!;
            if (!subscription) {
                throw Error('Unable to find subscription');
            }
            if (subscription.uid !== uid) {
                throw Error('Invalid UID');
            }
            let scheduling = (await this.store.WalletSubscriptionScheduling.findById(ctx, id))!;
            if (!scheduling) {
                throw Error('Invalid state');
            }

            // Just ignore if event is about invalid period
            if (scheduling.currentPeriodIndex !== index) {
                throw Error('Invalid payment');
            }

            let period = (await this.store.WalletSubscriptionPeriod.findById(ctx, id, index))!;

            // Check payment
            if (period.pid !== pid) {
                throw Error('Invalid payment');
            }
            if (period.state === 'canceled') {
                throw Error('Period is already in canceled state');
            }
            if (period.state === 'success') {
                throw Error('Period is already in success state');
            }
            if (subscription.state === 'expired') {
                throw Error('Payment success when subscription already expired');
            }
            period.state = 'canceled';

            // The only possible state for canceled payment
            if (subscription.state === 'retrying') {
                subscription.state = 'expired';
                if (this.routing.onSubscriptionExpired) {
                    await this.routing.onSubscriptionExpired(ctx, subscription.id);
                }
            }
        });
    }

    async resolveSubscriptionExpires(parent: Context, id: string) {
        return await inTx(parent, async (ctx) => {
            let subscription = (await this.store.WalletSubscription.findById(ctx, id));
            if (!subscription) {
                throw new NotFoundError();
            }
            let scheduling = await this.store.WalletSubscriptionScheduling.findById(ctx, id);
            let start = Date.now();
            if (scheduling) {
                start = (await this.store.WalletSubscriptionPeriod.findById(ctx, subscription.id, scheduling.currentPeriodIndex))!.start;
            }

            if (subscription.interval === 'week') {
                return start + WEEK;
            } else if (subscription.interval === 'month') {
                return nextRenewMonthly(start);
            } else {
                throw new Error('Unexpected period');
            }
        });
    }
}