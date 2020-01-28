import { uuid } from 'openland-utils/uuid';
import { Context } from '@openland/context';
import { Store, WalletSubscriptionCreateShape } from './../../openland-module-db/store';
import { inTx } from '@openland/foundationdb';
import { PaymentsAsyncRepository } from './PaymentsAsyncRepository';
import { nextRenewMonthly } from './utils/nextRenewMonthly';
import { RoutingRepository } from './RoutingRepository';

const DAY = 24 * 60 * 60 * 1000; // ms in day

const WEEK = 7 * DAY; // ms in week

export class SubscriptionsRepository {
    readonly store: Store;
    readonly payments: PaymentsAsyncRepository;
    private routing!: RoutingRepository;

    constructor(store: Store, payments: PaymentsAsyncRepository) {
        this.store = store;
        this.payments = payments;
    }

    setRouting = (routing: RoutingRepository) => {
        this.routing = routing;
    }

    createSubscription = async (parent: Context, uid: number, amount: number, interval: 'week' | 'month', product: WalletSubscriptionCreateShape['proudct']) => {
        return await inTx(parent, async (ctx) => {
            let sid = uuid();
            let start = Date.now();
            let subscription = await this.store.WalletSubscription.create(ctx, sid, {
                uid: uid,
                amount: amount,
                interval: interval,
                start: start,
                state: 'started',
                proudct: product
            });
            return subscription;
        });
    }

    cancelSubscription = async (parent: Context, id: string) => {
        return await inTx(parent, async (ctx) => {
            let s = (await this.store.WalletSubscription.findById(ctx, id));
            if (!s) {
                throw Error('Unable to find subscription');
            }
            if (s.state !== 'canceled') {
                s.state = 'canceled';
                if (this.routing.onSubscriptionCanceled) {
                    await this.routing.onSubscriptionCanceled(ctx, id);
                }
            }
        });
    }

    //
    // Subscription Scheduling
    //

    planScheduling = async (parent: Context, id: string, now: number) => {
        return await inTx<'schedule' | 'nothing' | 'start_grace_period' | 'start_retry' | 'try_cancel' | 'expire'>(parent, async (ctx) => {
            let subscription = (await this.store.WalletSubscription.findById(ctx, id))!;
            let scheduling = await this.store.WalletSubscriptionScheduling.findById(ctx, id);

            // Very first scheduling
            if (!scheduling) {
                return 'schedule';
            }

            // Check current period state
            let period = (await this.store.WalletSubscriptionPeriod.findById(ctx, subscription.id, scheduling.currentPeriodIndex))!;

            // Expire subscription
            if (subscription.state === 'canceled') {
                if (subscription.interval === 'week') {
                    if ((now - period.start) > WEEK) {
                        return 'expire';
                    } else {
                        return 'nothing';
                    }
                } else if (subscription.interval === 'month') {
                    let periodEnd = nextRenewMonthly(period.start);
                    if (now > periodEnd) {
                        return 'expire';
                    } else {
                        return 'nothing';
                    }
                }
            }

            // Check if there are need to schedule next period
            if (period.state === 'success') {
                if (subscription.interval === 'week') {

                    // If more than a week elapsed
                    if ((now - period.start) > WEEK) {
                        return 'schedule';
                    } else {
                        return 'nothing';
                    }
                } else if (subscription.interval === 'month') {

                    // If previous period already passed
                    let periodEnd = nextRenewMonthly(period.start);
                    if (now > periodEnd) {
                        return 'schedule';
                    } else {
                        return 'nothing';
                    }
                } else {
                    throw Error('Unknown subscription interval: ' + subscription.interval);
                }
            }

            // Check if there are need to update subscription state or cancel it
            if (period.state === 'failing') {

                // Start grace period on first failing
                if (subscription.state === 'started') {
                    return 'start_grace_period';
                }

                // Switch to retry period after grace period expired
                if (subscription.state === 'grace_period') {
                    let gracePeriod = subscription.interval === 'week' ? (6 * DAY) : (16 * DAY);
                    if (now - period.start > gracePeriod) {
                        return 'start_retry';
                    }
                }

                // Cancel subscription after 60 days
                if (subscription.state === 'retrying') {
                    if (now - period.start > (60 * DAY)) {
                        return 'try_cancel';
                    }
                }
                return 'nothing';
            } else if (period.state === 'pending') {
                // Do nothing since payment is not yet processed
                return 'nothing';
            } else if (period.state === 'canceling') {
                // Do nothing since payment is already in canceling state
                return 'nothing';
            } else {
                throw Error('Unknown period state ' + period.state);
            }
        });
    }

    scheduleNextPeriod = async (parent: Context, id: string) => {
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
            let start: number;
            let index: number;
            if (scheduling) {
                let period = (await this.store.WalletSubscriptionPeriod.findById(ctx, subscription.id, scheduling.currentPeriodIndex))!;
                if (period.state !== 'success') {
                    throw Error('Unable to extend subscription when previous period is not in success state');
                }
                scheduling.currentPeriodIndex++;
                let nextPeriodStart = subscription.interval === 'week' ? period.start + WEEK : nextRenewMonthly(period.start);
                index = scheduling.currentPeriodIndex;
                start = nextPeriodStart;
            } else {
                await this.store.WalletSubscriptionScheduling.create(ctx, subscription.id, {
                    currentPeriodIndex: 1
                });
                start = subscription.start;
                index = 1;
            }

            // Create Payment
            let pid = uuid();
            await this.payments.createPayment(ctx, pid, subscription.uid, subscription.amount, {
                type: 'subscription',
                uid: subscription.uid,
                subscription: subscription.id,
                period: index
            });

            // Create Period
            await this.store.WalletSubscriptionPeriod.create(ctx, subscription.id, index, {
                pid: pid,
                start: start,
                state: 'pending'
            });
        });
    }

    enterGracePeriod = async (parent: Context, uid: number, id: string) => {
        await inTx(parent, async (ctx) => {
            let subscription = (await this.store.WalletSubscription.findById(ctx, id))!;
            if (!subscription) {
                throw Error('Unable to find subscription');
            }
            if (subscription.uid !== uid) {
                throw Error('Invalid UID');
            }

            if (subscription.state === 'started') {
                subscription.state = 'grace_period';
                if (this.routing.onSubscriptionFailing) {
                    await this.routing.onSubscriptionFailing(ctx, id);
                }
            } else {
                throw Error('Unable to enter grace state from ' + subscription.state + ' state');
            }
        });
    }

    enterRetryingPeriod = async (parent: Context, uid: number, id: string) => {
        await inTx(parent, async (ctx) => {
            let subscription = (await this.store.WalletSubscription.findById(ctx, id))!;
            if (!subscription) {
                throw Error('Unable to find subscription');
            }
            if (subscription.uid !== uid) {
                throw Error('Invalid UID');
            }

            if (subscription.state === 'grace_period') {
                subscription.state = 'retrying';
                if (this.routing.onSubscriptionPaused) {
                    await this.routing.onSubscriptionPaused(ctx, id);
                }
            } else {
                throw Error('Unable to enter grace state from ' + subscription.state + ' state');
            }
        });
    }

    enterExpiredState = async (parent: Context, uid: number, id: string) => {
        await inTx(parent, async (ctx) => {
            let subscription = (await this.store.WalletSubscription.findById(ctx, id))!;
            if (!subscription) {
                throw Error('Unable to find subscription');
            }
            if (subscription.uid !== uid) {
                throw Error('Invalid UID');
            }

            if (subscription.state === 'retrying' || subscription.state === 'canceled') {
                subscription.state = 'expired';
                if (this.routing.onSubscriptionExpired) {
                    await this.routing.onSubscriptionExpired(ctx, id);
                }
            } else {
                throw Error('Unable to enter grace state from ' + subscription.state + ' state');
            }
        });
    }

    enterCanceledState = async (parent: Context, uid: number, id: string) => {
        await inTx(parent, async (ctx) => {
            let subscription = (await this.store.WalletSubscription.findById(ctx, id))!;
            if (!subscription) {
                throw Error('Unable to find subscription');
            }
            if (subscription.uid !== uid) {
                throw Error('Invalid UID');
            }

            if (subscription.state === 'started') {
                subscription.state = 'canceled';
                if (this.routing.onSubscriptionCanceled) {
                    await this.routing.onSubscriptionCanceled(ctx, id);
                }
            } else {
                throw Error('Unable to enter grace state from ' + subscription.state + ' state');
            }
        });
    }

    //
    // Payment Events
    //

    handlePaymentSuccess = async (parent: Context, uid: number, id: string, index: number) => {
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
                // Actually should be fatal error!
                return;
            }

            // Update period state only when in pending state
            let period = (await this.store.WalletSubscriptionPeriod.findById(ctx, id, index))!;
            if (period.state === 'pending') {
                // Nothing changed in subscription - first payment went successful
                period.state = 'success';
                return;
            }
            if (period.state === 'canceling') {
                // While we were trying to cancel subscription, payment still gone through - mark period as successful
                period.state = 'success';
                return;
            }
            if (period.state === 'failing') {
                period.state = 'success';

                if (subscription.state === 'grace_period') {
                    // Nothing changed in subscription - payment within grace peryid went successful

                    // Mark subscription as started
                    subscription.state = 'started';

                    // Recover callback
                    if (this.routing.onSubscriptionRecovered) {
                        await this.routing.onSubscriptionRecovered(ctx, subscription.id);
                    }
                } else if (subscription.state === 'retrying') {

                    // Mark subscription as started
                    subscription.state = 'started';

                    // Restart subscription with new period start date
                    period.start = Date.now();

                    // Restart callback
                    if (this.routing.onSubscriptionRestarted) {
                        await this.routing.onSubscriptionRestarted(ctx, subscription.id);
                    }
                }
                return;
            }

            if (period.state === 'success') {
                // Should not be possible
                return;
            }

            throw Error('Unknown period state: ' + period.state);
        });
    }

    handlePaymentFailing = async (parent: Context, uid: number, id: string, index: number) => {
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
                return;
            }

            // Update period state only when in pending state
            let period = (await this.store.WalletSubscriptionPeriod.findById(ctx, id, index))!;
            if (period.state === 'pending') {
                period.state = 'failing';
                // Subscription state will be updated on next scheduling iteration
            }
        });
    }

    handlePaymentCanceled = async (parent: Context, uid: number, id: string, index: number) => {
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
                // Actually should be fatal error!
                return;
            }

            // Update period state only when in pending state
            let period = (await this.store.WalletSubscriptionPeriod.findById(ctx, id, index))!;
            if (period.state !== 'success') {
                if (subscription.state === 'retrying' || subscription.state === 'grace_period') {
                    // Expire immediatelly if retrying or in grace period
                    subscription.state = 'expired';
                    if (this.routing.onSubscriptionExpired) {
                        await this.routing.onSubscriptionExpired(ctx, subscription.id);
                    }
                } else if (subscription.state === 'canceled' || subscription.state === 'expired') {
                    // Ignore?
                } else if (subscription.state === 'started') {
                    // Cancel subscription (but not expire!)
                    subscription.state = 'canceled';
                    if (this.routing.onSubscriptionCanceled) {
                        await this.routing.onSubscriptionCanceled(ctx, subscription.id);
                    }
                } else {
                    throw Error('Unknown subscription state: ' + subscription.state);
                }
            } else {
                // Success state here is some fatal inconsistency!
            }
        });
    }
}