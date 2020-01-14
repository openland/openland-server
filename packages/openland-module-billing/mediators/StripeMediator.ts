import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { BillingRepository } from './../repo/BillingRepository';
import { Store } from 'openland-module-db/FDB';
import Stripe from 'stripe';

export class StripeMediator {

    readonly repo: BillingRepository;
    private readonly stripe: Stripe;

    constructor(token: string, repo: BillingRepository) {
        this.repo = repo;
        this.stripe = new Stripe(token, { apiVersion: '2019-12-03', typescript: true });
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

            // Save result
            // customer.stripeId = stripeCustomer.id;
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
        let stripeCustomer = await this.stripe.customers.create({
            email: src.user.email,
            name: (src.profile.firstName + ' ' + (src.profile.lastName || '')).trim(),
            metadata: { uid: uid }
        }, { idempotencyKey: 'create-' + src.customer.uniqueKey, timeout: 5000 });

        //
        // Save Result
        //

        await inTx(parent, async (ctx) => {
            let customer = await Store.UserStripeCustomer.findById(ctx, uid);
            if (!customer) {
                throw Error('Unable to create customer without customer record');
            }
            if (customer.stripeId) {
                return;
            }
            customer.stripeId = stripeCustomer.id;
        });
    }

    enableBillingAndAwait = async (parent: Context, uid: number) => {

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
                await this.repo.enableBilling(parent, uid);
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

    registerCard = async (parent: Context, uid: number, pmid: string) => {
        await this.enableBillingAndAwait(parent, uid);

        let data = await this.stripe.paymentMethods.retrieve(pmid);

        return await inTx(parent, async (ctx) => {
            let isFirstOne = (await Store.UserStripeCard.users.findAll(ctx, uid)).length === 0;
            let res = await Store.UserStripeCard.create(ctx, uid, pmid, {
                default: isFirstOne,
                deleted: false,
                brand: data.card!.brand,
                country: data.card!.country!,
                exp_month: data.card!.exp_month,
                exp_year: data.card!.exp_year,
                last4: data.card!.last4,
                stripeAttached: false,
                stripeDetached: false
            });
            await this.repo.syncCardQueue.pushWork(ctx, { uid, pmid });
            return res;
        });
    }

    //
    // Card Sync
    //

    syncCard = async (parent: Context, uid: number, pmid: string) => {
        await this.enableBillingAndAwait(parent, uid);
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
        await this.enableBillingAndAwait(parent, uid);
        let customerId = await inTx(parent, async (ctx: Context) => {
            let res = (await Store.UserStripeCustomer.findById(ctx, uid))!.stripeId;
            if (!res) {
                throw Error('Internal error');
            }
            return res;
        });
        let intent = await this.stripe.setupIntents.create({
            customer: customerId,
            usage: 'off_session'
        }, { idempotencyKey: retryKey });
        return intent;
    }
}