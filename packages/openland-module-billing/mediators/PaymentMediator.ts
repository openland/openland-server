import { createLogger } from '@openland/log';
import { uuid } from 'openland-utils/uuid';
import { RoutingRepository } from './../repo/RoutingRepository';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { PaymentsRepository } from '../repo/PaymentsRepository';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { Store } from 'openland-module-db/FDB';
import Stripe from 'stripe';
import { WalletRepository } from 'openland-module-billing/repo/WalletRepository';
import { PaymentsAsyncRepository } from 'openland-module-billing/repo/PaymentsAsyncRepository';
import { backoff } from 'openland-utils/timer';
import { paymentAmounts } from 'openland-module-billing/repo/utils/paymentAmounts';

const log = createLogger('payments');

export class PaymentMediator {

    readonly liveMode: boolean;
    readonly paymentsAsync: PaymentsAsyncRepository;
    readonly payments: PaymentsRepository;
    readonly wallet: WalletRepository;
    private routing!: RoutingRepository;

    readonly stripe: Stripe;
    readonly createCustomerQueue = new WorkQueue<{ uid: number }, { result: string }>('stripe-customer-export-task', -1);
    readonly syncCardQueue = new WorkQueue<{ uid: number, pmid: string }, { result: string }>('stripe-customer-export-card-task', -1);
    // readonly paymentProcessorQueue = new WorkQueue<{ uid: number, pid: string }, { result: string }>('stripe-payment-task', -1);

    constructor(token: string, payments: PaymentsRepository, wallet: WalletRepository, paymentsAsync: PaymentsAsyncRepository) {
        this.payments = payments;
        this.paymentsAsync = paymentsAsync;
        this.stripe = new Stripe(token, { apiVersion: '2019-12-03', typescript: true });
        this.liveMode = !token.startsWith('sk_test');
        this.wallet = wallet;
    }

    setRouting = (routing: RoutingRepository) => {
        this.routing = routing;
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
            email: src.user.email,
            name: (src.profile.firstName + ' ' + (src.profile.lastName || '')).trim(),
        });

        //
        // Save Result
        //

        await this.payments.applyCustomerId(parent, uid, stripeCustomer.id);
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
                await this.payments.enablePayments(ctx, uid);
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
            let res = await this.payments.addPaymentMethod(parent, uid, pm);
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
            let res = await this.payments.removePaymentMethod(parent, uid, pmid);
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
            await this.payments.makePaymentMethodDefault(ctx, uid, pmid);
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
        let customerId = await this.payments.getCustomerId(parent, uid);
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
        let customerId = await this.payments.getCustomerId(parent, uid);

        // Create Payment Intent
        let intent = await this.stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            customer: customerId,
            payment_method: pmid
        }, { idempotencyKey: 'di-' + uid + '-' + retryKey });

        // Register Payment Intent
        await this.payments.registerPaymentIntent(parent, intent.id, amount, null, { type: 'deposit', txid: null, uid: uid });

        return intent;
    }

    //
    // Create off-session deposit payment
    //

    createDepositPayment = async (parent: Context, uid: number, amount: number, retryKey: string) => {
        await this.enablePaymentsAndAwait(parent, uid);

        await inTx(parent, async (ctx) => {

            // Retry Handling
            let retry = await Store.WalletDepositRequest.findById(ctx, uid, retryKey);
            if (retry) {
                return;
            }
            let pid = uuid();
            await Store.WalletDepositRequest.create(ctx, uid, retryKey, { pid: pid });

            // Wallet Transaction
            let txid = await this.wallet.depositAsync(ctx, uid, amount, pid);

            // Payment
            await this.paymentsAsync.createPayment(ctx, pid, uid, amount, {
                type: 'deposit',
                uid: uid,
                txid: txid
            });
        });
    }

    //
    // Create off-session transfer payment
    //

    createTransferPayment = async (parent: Context, fromUid: number, toUid: number, amount: number, retryKey: string) => {
        await this.enablePaymentsAndAwait(parent, fromUid);

        await inTx(parent, async (ctx) => {

            // Retry Handling
            let retry = await Store.WalletTransferRequest.findById(ctx, fromUid, toUid, retryKey);
            if (retry) {
                return;
            }

            let walletBalance = (await this.wallet.getWallet(ctx, fromUid)).balance;

            let amounts = paymentAmounts(walletBalance, amount);

            if (amounts.charge === 0) {
                // Retry
                await Store.WalletTransferRequest.create(ctx, fromUid, toUid, retryKey, { pid: null });
                // Wallet transfer
                await this.wallet.transferBalance(ctx, fromUid, toUid, amount);
            } else {
                // Retry
                let pid = uuid();
                await Store.WalletTransferRequest.create(ctx, fromUid, toUid, retryKey, { pid: pid });

                // Transaction
                let { txOut, txIn } = await this.wallet.transferAsync(ctx, fromUid, toUid, amounts.wallet, amounts.charge, pid);

                // Payment
                await this.paymentsAsync.createPayment(ctx, pid, fromUid, amount, {
                    type: 'transfer',
                    fromUid,
                    fromTx: txOut,
                    toUid,
                    toTx: txIn
                });
            }
        });
    }

    //
    // Payment Execution
    //

    private createPaymentIntent = async (parent: Context, uid: number, pid: string) => {

        // Await Billing Enable
        await this.enablePaymentsAndAwait(parent, uid);

        // Load CustomerID
        let customerId = await this.payments.getCustomerId(parent, uid);

        // Load payment
        let payment = (await Store.Payment.findById(parent, pid))!;

        // Create Payment Intent
        let intent = await this.stripe.paymentIntents.create({
            amount: payment.amount,
            currency: 'usd',
            customer: customerId
        }, { idempotencyKey: 'payment-' + pid, timeout: 5000 });

        // Save Payment Intent id
        await this.payments.registerPaymentIntent(parent, intent.id, payment.amount, pid, payment.operation);

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

        //
        // Create Payment Intent if needed
        //

        if (!payment.piid) {
            let intent = await this.createPaymentIntent(parent, uid, payment.id);
            payment = await inTx(parent, async (ctx) => {
                let res = (await Store.Payment.findById(ctx, pid))!;
                if (!res.piid && res.state !== 'canceled') {
                    res.piid = intent.id;
                }
                return res;
            });
        }
        if (payment.state === 'canceled') { // Exit if payment already canceled
            return;
        }
        let piid = payment.piid!!;

        //
        // Check Payment Intent state
        //

        let intentState = await this.stripe.paymentIntents.retrieve(piid);
        if (intentState.status === 'succeeded' || intentState.status === 'canceled') {
            if (intentState.status === 'canceled') {
                await this.paymentsAsync.handlePaymentIntentCanceled(parent, payment.id);
            }
            if (intentState.status === 'succeeded') {
                await this.paymentsAsync.handlePaymentIntentSuccess(parent, payment.id);
            }
            return true; /* Completed */
        }

        //
        // Pick Default Card
        //

        let card = await inTx(parent, async (ctx) => {
            let cards = await Store.UserStripeCard.findAll(ctx);
            let dcard = cards.find((v) => v.default);
            if (!dcard) {
                // Notify about failing to charge
                await this.paymentsAsync.handlePaymentFailing(parent, payment.id);
                throw Error('Unable to find default card');
            }
            return dcard;
        });

        //
        // Perform Payment
        //

        try {
            await this.stripe.paymentIntents.confirm(piid, { payment_method: card.pmid, off_session: true }, { timeout: 15000 });
            await this.updatePaymentIntent(parent, piid);
            return true; /* Completed: Successful */
        } catch (err) {

            if (err.code === 'authentication_required') {

                // Change Payment Status
                await this.paymentsAsync.handlePaymentActionRequired(parent, payment.id);

                return true; /* Completed: Need user input */
            } else if (err.code === 'requires_payment_method' || err.code === 'card_declined') {

                // Change Payment Status
                await this.paymentsAsync.handlePaymentFailing(parent, payment.id);

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
    // Handle Payment Intent success
    //

    updatePaymentIntent = async (parent: Context, id: string) => {

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
                if (await this.payments.paymentIntentSuccess(ctx, id)) {
                    let intent = (await Store.PaymentIntent.findById(ctx, id))!;
                    if (intent.pid) {
                        await this.paymentsAsync.handlePaymentIntentSuccess(ctx, intent.pid);
                    } else {
                        if (this.routing.routeSuccessfulPaymentIntent) {
                            await this.routing.routeSuccessfulPaymentIntent(ctx, intent.amount, intent.operation);
                        }
                    }
                }
            });
        } else if (dp.status === 'canceled') {
            await inTx(parent, async (ctx) => {
                if (await this.payments.paymentIntentCancel(ctx, id)) {
                    let intent = (await Store.PaymentIntent.findById(ctx, id))!;
                    if (intent.pid) {
                        await this.paymentsAsync.handlePaymentIntentCanceled(ctx, intent.pid);
                    } else {
                        // Nothing to do
                    }
                }
            });
        }
    }

    //
    // Cancel Payment Intent
    //

    tryCancelPaymentIntent = async (parent: Context, uid: number, pid: string) => {
        let payment = await inTx(parent, async (ctx) => {

            let res = (await Store.Payment.findById(ctx, pid))!;
            if (!res) {
                throw Error('Unknown payment id ' + pid);
            }
            if (res.uid !== uid) {
                throw Error('Invalid payment uid');
            }
            if (res.state === 'canceled') {
                return true;
            }

            if (!res.piid) {
                await this.paymentsAsync.handlePaymentIntentCanceled(ctx, pid);
                res.state = 'canceled';
                return true;
            }

            return res;
        });

        if (payment === true) {
            return true;
        }
        let piid = payment.piid!;
        return await backoff(parent, async () => {
            while (true) {
                let intentState = await this.stripe.paymentIntents.retrieve(piid);
                if (intentState.status === 'canceled') {
                    await inTx(parent, async (ctx) => {
                        await this.paymentsAsync.handlePaymentIntentCanceled(ctx, pid);
                    });
                    return true;
                }
                if (intentState.status === 'succeeded') {
                    await inTx(parent, async (ctx) => {
                        await this.paymentsAsync.handlePaymentIntentSuccess(ctx, pid);
                    });
                    return false;
                }

                await this.stripe.paymentIntents.cancel(piid);
            }
        });
    }
}