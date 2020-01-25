import { uuid } from 'openland-utils/uuid';
import { RoutingRepository } from './../repo/RoutingRepository';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { PaymentsRepository } from '../repo/PaymentsRepository';
import { PaymentIntentCreateShape } from '../../openland-module-db/store';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { BillingRepository } from '../repo/BillingRepository';
import { Store } from 'openland-module-db/FDB';
import Stripe from 'stripe';

export class PaymentMediator {

    readonly liveMode: boolean;
    readonly repo: BillingRepository;
    readonly payments: PaymentsRepository;
    readonly routing: RoutingRepository;
    readonly stripe: Stripe;
    readonly createCustomerQueue = new WorkQueue<{ uid: number }, { result: string }>('stripe-customer-export-task', -1);
    readonly syncCardQueue = new WorkQueue<{ uid: number, pmid: string }, { result: string }>('stripe-customer-export-card-task', -1);
    readonly paymentProcessorQueue = new WorkQueue<{ uid: number, pid: string }, { result: string }>('stripe-payment-task', -1);

    constructor(token: string, repo: BillingRepository, payments: PaymentsRepository, routing: RoutingRepository) {
        this.repo = repo;
        this.payments = payments;
        this.stripe = new Stripe(token, { apiVersion: '2019-12-03', typescript: true });
        this.liveMode = !token.startsWith('sk_test');
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
        await this.payments.registerPaymentIntent(parent, intent.id, amount, { type: 'deposit', uid: uid });

        return intent;
    }

    //
    // Create Pay Intent for Off Session usage
    //

    createPaymentIntent = async (parent: Context, uid: number, amount: number, retryKey: string, operation: PaymentIntentCreateShape['operation']) => {

        // Await Billing Enable
        await this.enablePaymentsAndAwait(parent, uid);

        // Load CustomerID
        let customerId = await this.payments.getCustomerId(parent, uid);

        // Create Payment Intent
        let intent = await this.stripe.paymentIntents.create({
            amount: amount,
            currency: 'usd',
            customer: customerId
        }, { idempotencyKey: 'di-' + uid + '-' + retryKey });

        // Save Payment Intent id
        await this.payments.registerPaymentIntent(parent, intent.id, amount, operation);

        return intent;
    }

    //
    // Create Payment
    //

    createPayment = async (parent: Context, uid: number, amount: number, retryKey: string, operation: PaymentIntentCreateShape['operation']) => {
        await this.enablePaymentsAndAwait(parent, uid);

        await inTx(parent, async (ctx) => {
            let ex = await Store.Payment.retry.find(ctx, uid, retryKey);
            if (ex) {
                return ex;
            }

            let res = await Store.Payment.create(ctx, uuid(), {
                uid: uid,
                amount: amount,
                state: 'pending',
                operation: operation,
                retryKey: retryKey
            });

            await this.paymentProcessorQueue.pushWork(ctx, { uid: uid, pid: res.id });

            return res;
        });
    }

    //
    // Handle Payment Intent success
    //

    updatePaymentIntent = async (parent: Context, id: string) => {
        let dp = await this.stripe.paymentIntents.retrieve(id);
        if (dp.status === 'succeeded') {
            await this.payments.paymentIntentSuccess(parent, id, async (ctx, amount, op) => {
                await this.routing.routeSuccessfulPayment(ctx, amount, op);
            });
        }
    }
}