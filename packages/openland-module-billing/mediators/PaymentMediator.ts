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

const log = createLogger('payments');

export class PaymentMediator {

    readonly liveMode: boolean;
    readonly payments: PaymentsRepository;
    readonly routing: RoutingRepository;
    readonly wallet: WalletRepository;

    readonly stripe: Stripe;
    readonly createCustomerQueue = new WorkQueue<{ uid: number }, { result: string }>('stripe-customer-export-task', -1);
    readonly syncCardQueue = new WorkQueue<{ uid: number, pmid: string }, { result: string }>('stripe-customer-export-card-task', -1);
    readonly paymentProcessorQueue = new WorkQueue<{ uid: number, pid: string }, { result: string }>('stripe-payment-task', -1);

    constructor(token: string, payments: PaymentsRepository, routing: RoutingRepository, wallet: WalletRepository) {
        this.payments = payments;
        this.stripe = new Stripe(token, { apiVersion: '2019-12-03', typescript: true });
        this.liveMode = !token.startsWith('sk_test');
        this.routing = routing;
        this.wallet = wallet;
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
                await this.payments.enablePayments(parent, uid);
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
    // Create Card Intent
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
    // Create On Session Deposit Intent
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
    // Create Pay Intent for Off Session usage
    //

    createPaymentIntent = async (parent: Context, uid: number, pid: string) => {

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

    //
    // Create Payment
    //

    createDepositPayment = async (parent: Context, uid: number, amount: number, retryKey: string) => {
        await this.enablePaymentsAndAwait(parent, uid);

        await inTx(parent, async (ctx) => {
            let ex = await Store.Payment.retry.find(ctx, uid, retryKey);
            if (ex) {
                return ex;
            }

            let pid = uuid();
            let txid = await this.wallet.depositAsync(ctx, uid, amount, pid);
            let res = await Store.Payment.create(ctx, pid, {
                uid: uid,
                amount: amount,
                state: 'pending',
                operation: {
                    type: 'deposit',
                    uid: uid,
                    txid: txid
                },
                retryKey: retryKey
            });

            await this.paymentProcessorQueue.pushWork(ctx, { uid: uid, pid: pid });

            return res;
        });
    }

    //
    // Payment Execution
    //

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
                if (!res.piid) {
                    res.piid = intent.id;
                }
                return res;
            });
        }
        let piid = payment.piid!!;

        //
        // Check Payment Intent state
        //
        
        let intentState = await this.stripe.paymentIntents.retrieve(piid);
        if (intentState.status === 'succeeded' || intentState.status === 'canceled') {
            // Just exit if intent is in completed state
            return;
        }

        //
        // Pick Default Card
        //

        let card = await inTx(parent, async (ctx) => {
            let cards = await Store.UserStripeCard.findAll(ctx);
            let dcard = cards.find((v) => v.default);
            if (!dcard) {
                throw Error('Unable to find default card');
            }
            return dcard;
        });

        //
        // Perform Payment
        //

        try {
            await this.stripe.paymentIntents.confirm(piid, { payment_method: card.pmid, off_session: true }, { timeout: 15000 });
        } catch (err) {

            if (err.code === 'authentication_required') {
                // Change Payment Status
                await inTx(parent, async (ctx) => {
                    let res = (await Store.Payment.findById(ctx, pid))!;
                    if (res.state !== 'success' && res.state !== 'canceled' && res.state !== 'action_required') {
                        res.state = 'action_required';

                        await this.routing.routeActionNeededPayment(ctx, res.amount, res.id, res.operation);
                    }
                });
            } else if (err.code === 'requires_payment_method' || err.code === 'card_declined') {
                // Change Payment Status
                await inTx(parent, async (ctx) => {
                    let res = (await Store.Payment.findById(ctx, pid))!;
                    if (res.state !== 'success' && res.state !== 'canceled' && res.state !== 'failing') {
                        res.state = 'failing';

                        await this.routing.routeFailingPayment(ctx, res.amount, res.id, res.operation);
                    }
                });
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
        let dp = await this.stripe.paymentIntents.retrieve(id);
        if (dp.status === 'succeeded') {
            await this.payments.paymentIntentSuccess(parent, id, async (ctx, amount, pid, op) => {
                await this.routing.routeSuccessfulPayment(ctx, amount, pid, op);
            });
        }
    }
}