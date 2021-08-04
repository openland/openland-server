import { createLogger } from '@openland/log';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { PaymentIntentsRepository } from '../repo/PaymentIntentsRepository';
import { inTx } from '@openland/foundationdb';
import { Context, createNamedContext } from '@openland/context';
import { Store } from 'openland-module-db/FDB';
import Stripe from 'stripe';
import { backoff } from 'openland-utils/timer';
import { PaymentsRepository } from 'openland-module-wallet/repo/PaymentsRepository';
import { SubscriptionsRepository } from 'openland-module-wallet/repo/SubscriptionsRepository';

const log = createLogger('payments');

export class PaymentMediator {

    readonly liveMode: boolean;
    readonly paymentIntents: PaymentIntentsRepository;
    readonly payments: PaymentsRepository;
    readonly subscription: SubscriptionsRepository;

    readonly stripe: Stripe;
    readonly createCustomerQueue = new WorkQueue<{ uid: number }>('stripe-customer-export-task', -1);
    readonly syncCardQueue = new WorkQueue<{ uid: number, pmid: string }>('stripe-customer-export-card-task', -1);

    constructor(token: string, paymentIntents: PaymentIntentsRepository, payments: PaymentsRepository, subscription: SubscriptionsRepository) {
        this.paymentIntents = paymentIntents;
        this.payments = payments;
        this.subscription = subscription;
        this.stripe = new Stripe(token, { apiVersion: '2020-08-27', typescript: true });
        this.liveMode = !token.startsWith('sk_test');
        let ctx = createNamedContext('PaymentMediator');
        log.debug(ctx, this.liveMode ? 'live' : 'test');
    }

    exportCustomer = async (parent: Context, uid: number) => {

        //
        // Load initial state
        //

        let src = await inTx(parent, async (ctx) => {

            // Load User
            let user = await Store.User.findById(ctx, uid);
            if (!user) {
                throw Error('Unable to create customer without user');
            }

            // Load Profile
            let profile = await Store.UserProfile.findById(ctx, uid);
            if (!profile) {
                throw Error('Unable to create customer without profile');
            }

            // Customer Record
            let customer = await Store.UserStripeCustomer.findById(ctx, uid);
            if (!customer) {
                throw Error('Unable to create customer without customer record');
            }

            // Ignore if customer already exported
            if (customer.stripeId) {
                return false;
            }

            return { user, profile, customer };
        });
        if (!src) { // Ignore if customer already exists
            return;
        }

        //
        // Create Customer
        //
        // I wanted to make double check if customer is actually exists in dashboard via search
        // for a user with metadata's uid field value. Unfortunatelly Stripe API does not allow such
        // search. Since this is a very first call before any other billing operations the
        // worst case is having double accounts for users, but only one will be used and
        // nothing bad is possible except multiple accounts.
        //
        // Also idempotency (retry) key is valid for at least 24 hours and will work just fine for
        // restarting transaction or worker task. So chance of double accounts is very very small.
        //
        // NOTE: Since between retries user name could be changed we need to create empty customer and then update
        // it's profile values instead. Otherwise stripe will throw error
        //

        let stripeCustomer = await this.stripe.customers.create({
            metadata: { uid: uid }
        }, { idempotencyKey: 'create-' + src.customer.uniqueKey, timeout: 5000 });
        await this.stripe.customers.update(stripeCustomer.id, {
            email: src.user.email || undefined,
            name: (src.profile.firstName + ' ' + (src.profile.lastName || '')).trim(),
        });

        //
        // Save Result
        //

        await this.paymentIntents.applyCustomerId(parent, uid, stripeCustomer.id);
    }

    enablePaymentsAndAwait = async (parent: Context, uid: number) => {

        //
        // Check if billing is enabled and enable if it is required
        //

        let src = await inTx(parent, async (ctx) => {

            // Load User
            let user = await Store.User.findById(ctx, uid);
            if (!user) {
                throw Error('Unable to create customer without user');
            }

            // Load Profile
            let profile = await Store.UserProfile.findById(ctx, uid);
            if (!profile) {
                throw Error('Unable to create customer without profile');
            }

            // Customer Record
            let customer = await Store.UserStripeCustomer.findById(ctx, uid);
            if (!customer) {
                await this.paymentIntents.enablePayments(ctx, uid);
                await this.createCustomerQueue.pushWork(ctx, { uid });
                return false;
            }

            // Ignore if customer already exported
            if (customer.stripeId) {
                return true;
            } else {
                return false;
            }
        });

        //
        // If Billing is not enabled on stripe - perfom out of order biling enable request
        //

        if (!src) {
            await this.exportCustomer(parent, uid);
        }
    }

    //
    // Cards
    //

    addPaymentMethdod = async (parent: Context, uid: number, pmid: string) => {

        // Enable Billing
        await this.enablePaymentsAndAwait(parent, uid);

        // Load Payment Method
        let pm = await this.stripe.paymentMethods.retrieve(pmid);

        // Add Payment Method
        return await inTx(parent, async (ctx) => {
            let res = await this.paymentIntents.addPaymentMethod(parent, uid, pm);
            if (res) {
                await this.syncCardQueue.pushWork(ctx, { uid, pmid });
            }
            return await Store.UserStripeCard.findById(ctx, uid, pmid);
        });
    }

    removePaymentMethod = async (parent: Context, uid: number, pmid: string) => {

        // Enable Billing
        await this.enablePaymentsAndAwait(parent, uid);

        // Remove Payment Method
        return await inTx(parent, async (ctx) => {
            let res = await this.paymentIntents.removePaymentMethod(parent, uid, pmid);
            if (res) {
                await this.syncCardQueue.pushWork(ctx, { uid, pmid });
            }
            return await Store.UserStripeCard.findById(ctx, uid, pmid);
        });
    }

    makePaymentMethodDefault = async (parent: Context, uid: number, pmid: string) => {

        // Enable Billing
        await this.enablePaymentsAndAwait(parent, uid);

        // Make Card Default
        return await inTx(parent, async (ctx) => {
            await this.paymentIntents.makePaymentMethodDefault(ctx, uid, pmid);
            return await Store.UserStripeCard.findById(ctx, uid, pmid);
        });
    }

    //
    // Card Sync
    //

    syncCard = async (parent: Context, uid: number, pmid: string) => {
        await this.enablePaymentsAndAwait(parent, uid);

        //
        // Do not change order! Detach operation expects card to
        // be attached first!
        //
        await this.attachCardIfNeeded(parent, uid, pmid);
        await this.detachCardIfNeeded(parent, uid, pmid);
    }

    private attachCardIfNeeded = async (parent: Context, uid: number, pmid: string) => {
        let src = await inTx(parent, async (ctx) => {
            let user = (await Store.UserStripeCustomer.findById(ctx, uid))!;
            if (!user || !user.stripeId) {
                throw Error('Missing Stripe ID');
            }
            let card = await Store.UserStripeCard.findById(ctx, uid, pmid);
            if (!card) {
                throw Error('Unable to find target card');
            }
            return { attached: card.stripeAttached, customerId: user.stripeId! };
        });

        if (!src.attached) {
            await this.stripe.paymentMethods.attach(pmid, { customer: src.customerId }, {
                idempotencyKey: 'attach-' + pmid
            });

            await inTx(parent, async (ctx) => {
                let card = await Store.UserStripeCard.findById(ctx, uid, pmid);
                if (!card!.stripeAttached) {
                    card!.stripeAttached = true;
                }
            });
        }
    }

    private detachCardIfNeeded = async (parent: Context, uid: number, pmid: string) => {
        let src = await inTx(parent, async (ctx) => {
            let user = (await Store.UserStripeCustomer.findById(ctx, uid))!;
            if (!user || !user.stripeId) {
                throw Error('Missing Stripe ID');
            }
            let card = await Store.UserStripeCard.findById(ctx, uid, pmid);
            if (!card) {
                throw Error('Unable to find target card');
            }
            return { deleted: card.deleted, detached: card.stripeDetached, customerId: user.stripeId! };
        });

        if (src.deleted && !src.detached) {
            await this.stripe.paymentMethods.detach(pmid, {}, {
                idempotencyKey: 'detach-' + pmid
            });

            await inTx(parent, async (ctx) => {
                let card = await Store.UserStripeCard.findById(ctx, uid, pmid);
                if (!card!.stripeDetached) {
                    card!.stripeDetached = true;
                }
            });
        }
    }

    //
    // Create Card Setup Intent
    //

    createSetupIntent = async (parent: Context, uid: number, retryKey: string) => {
        await this.enablePaymentsAndAwait(parent, uid);
        let customerId = await this.paymentIntents.getCustomerId(parent, uid);
        let intent = await this.stripe.setupIntents.create({
            customer: customerId,
            usage: 'off_session'
        }, { idempotencyKey: 'si-' + uid + '-' + retryKey });
        return intent;
    }

    //
    // Create on-session deposit intent
    //

    createDepositIntent = async (parent: Context, uid: number, pmid: string, amount: number, retryKey: string) => {

        // await this.enableBillingAndAwait(parent, uid); // No need since sync card do the same
        await this.syncCard(parent, uid, pmid);

        // Load CustomerID
        let customerId = await this.paymentIntents.getCustomerId(parent, uid);

        // Create Payment Intent
        let intent = await this.stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            customer: customerId,
            payment_method: pmid
        }, { idempotencyKey: 'di-' + uid + '-' + retryKey });

        // Register Payment Intent
        await this.paymentIntents.registerPaymentIntent(parent, intent.id, amount, { type: 'deposit', uid: uid });

        return intent;
    }

    //
    // Payment Execution
    //

    private createPaymentIntent = async (parent: Context, uid: number, pid: string) => {

        // Await Billing Enable
        await this.enablePaymentsAndAwait(parent, uid);

        // Load CustomerID
        let customerId = await this.paymentIntents.getCustomerId(parent, uid);

        // Load payment
        let payment = (await Store.Payment.findById(parent, pid))!;

        // Create Payment Intent
        let intent = await this.stripe.paymentIntents.create({
            amount: payment.amount,
            currency: 'usd',
            customer: customerId
        }, { idempotencyKey: 'payment-' + pid, timeout: 5000 });

        // Save Payment Intent id
        await this.paymentIntents.registerPaymentIntent(parent, intent.id, payment.amount, { type: 'payment', id: pid });

        return intent;
    }

    tryExecutePayment = async (parent: Context, uid: number, pid: string) => {

        //
        // Retreive Payment
        //

        let payment = await inTx(parent, async (ctx) => {
            let res = await Store.Payment.findById(ctx, pid);
            if (!res) {
                throw Error('Unknown payment id ' + pid);
            }
            if (res.uid !== uid) {
                throw Error('Invalid payment uid');
            }
            return res;
        });
        if (payment.state === 'canceled' || payment.state === 'success') { // Exit if payment already completed
            return;
        }

        //
        // Create Payment Intent if needed
        //
        if (!payment.piid) {
            let intent = await this.createPaymentIntent(parent, uid, payment.id);
            payment = await inTx(parent, async (ctx) => {
                let res = (await Store.Payment.findById(ctx, pid))!;
                // Do not set piid if already canceled
                if (!res.piid && res.state !== 'canceled') {
                    res.piid = intent.id;
                }
                return res;
            });
        }
        if (payment.state === 'canceled' || payment.state === 'success') { // Exit if payment already completed
            return;
        }
        let piid = payment.piid!!;

        //
        // Check Payment Intent state
        //

        if (await this.updatePaymentIntent(parent, piid)) {
            return true; /* Completed */
        }

        //
        // Pick Default Card
        //

        let card = await inTx(parent, async (ctx) => {
            let cards = await Store.UserStripeCard.users.findAll(ctx, uid);
            let dcard = cards.find((v) => v.default);
            return dcard;
        });

        if (!card) {
            // Notify about needing action from user
            await inTx(parent, async (ctx) => {
                await this.paymentIntents.paymentIntentNeedAction(ctx, piid);
            });
            return true; /* Completed: Need user input */
        }

        //
        // Perform Payment
        //

        try {
            await this.stripe.paymentIntents.confirm(piid, { payment_method: card.pmid, off_session: true }, { timeout: 15000 });
            await this.updatePaymentIntent(parent, piid);
            return true; /* Completed: Successful */
        } catch (err) {

            if (err.code === 'authentication_required') {
                // Notify about needing of action
                await inTx(parent, async (ctx) => {
                    await this.paymentIntents.paymentIntentNeedAction(ctx, piid);
                });
                return true; /* Completed: Need user input */
            } else if (
                err.code === 'requires_payment_method'
                || err.code === 'card_declined'
                || err.code === 'card_decline_rate_limit_exceeded'
                || err.code === 'incorrect_number'
            ) {

                // Notify about failing payment
                await inTx(parent, async (ctx) => {
                    await this.paymentIntents.paymentIntentFailing(ctx, piid);
                });

                return false; /* Failed */
            } else {
                // Unknown error - throw log exception and rethrow
                log.warn(parent, err);
                log.log(parent, 'Error code is: ', err.code);
                throw err;
            }
        }
    }

    //
    // Refresh Payment Intent states
    //

    updatePaymentIntent = async (parent: Context, id: string) => {

        let pi = await inTx(parent, async (ctx) => {
            return await Store.PaymentIntent.findById(ctx, id);
        });

        // Ignore unknown payment intent
        if (!pi) {
            return;
        }
        // Ignore canceled intent (no changes are possible)
        if (pi.state === 'canceled') {
            return;
        }
        // Ignore succeeded intents (no changes are possible)
        if (pi.state === 'success') {
            return;
        }

        //
        // There are high chances of race conditions here since this method is synching
        // state with stripe servers, but they are actually impossible.
        // We are looking only for two statuses - succeeded and canceled, they are both are
        // terminal states and therefore only one single branch could be executed.
        //
        // It is possible to have double invoke, but FDB transactions helps here.
        //

        let dp = await this.stripe.paymentIntents.retrieve(id);
        if (dp.status === 'succeeded') {
            await inTx(parent, async (ctx) => {
                await this.paymentIntents.paymentIntentSuccess(ctx, id);
            });
            return true; /* PaymentIntent in completed state */
        } else if (dp.status === 'canceled') {
            await inTx(parent, async (ctx) => {
                await this.paymentIntents.paymentIntentCancel(ctx, id);
            });
            return true; /* PaymentIntent in completed state */
        }
        return false; /* PaymentIntent in pending state */
    }

    //
    // Cancel Payment Intent
    //

    tryCancelPaymentIntent = async (parent: Context, id: string) => {

        //
        // Fast preflight check
        //

        let pi = await inTx(parent, async (ctx) => {
            let res = await Store.PaymentIntent.findById(ctx, id);
            if (!res) {
                throw Error('Unable to find payment intent');
            }
            return res;
        });
        if (pi.state === 'canceled') {
            return;
        }
        if (pi.state === 'success') {
            return;
        }

        //
        // Trying to cancel intent in loop untill intent is in completed state
        //

        await backoff(parent, async () => {
            while (true) {
                if (await this.updatePaymentIntent(parent, id)) {
                    return;
                }
                await this.stripe.paymentIntents.cancel(id);
            }
        });
    }

    //
    // Cancel Payment
    //

    tryCancelPayment = async (parent: Context, id: string) => {
        let piid = await inTx(parent, async (ctx) => {
            let p = (await Store.Payment.findById(ctx, id))!;
            if (!p.piid) {
                await this.payments.handlePaymentCanceled(ctx, id);
                return null;
            }
            return p.piid;
        });
        if (piid) {
            await this.tryCancelPaymentIntent(parent, piid);
        }
    }

    //
    // Cancel subscription
    //

    cancelSubscription = async (parent: Context, id: string) => {
        while (!await this.subscription.tryCancelSubscription(parent, id)) {
            let pid = await inTx(parent, async (ctx) => {
                let scheduling = (await Store.WalletSubscriptionScheduling.findById(ctx, id))!;
                let period = (await Store.WalletSubscriptionPeriod.findById(ctx, id, scheduling.currentPeriodIndex))!;
                return period.pid;
            });
            if (pid) {
                await this.tryCancelPayment(parent, pid);
            }
        }
    }
}
