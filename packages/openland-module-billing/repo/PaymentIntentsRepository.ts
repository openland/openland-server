import { createLogger } from '@openland/log';
import { uuid } from 'openland-utils/uuid';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { Store, PaymentIntentCreateShape } from '../../openland-module-db/store';
import Stripe from 'stripe';
import { checkMoney } from './utils/checkMoney';

const log = createLogger('payment-intent');

export class PaymentIntentsRepository {

    private readonly store: Store;

    constructor(store: Store) {
        this.store = store;
    }

    //
    // Customer ID
    //

    enablePayments = async (parent: Context, uid: number) => {
        return await inTx(parent, async (ctx) => {

            // Check if user exists
            let user = await this.store.User.findById(ctx, uid);
            if (!user) {
                throw Error('Unable to find user');
            }

            // Check if profile exists
            let profile = await this.store.UserProfile.findById(ctx, uid);
            if (!profile) {
                throw Error('Unable to enable payments without profile');
            }

            // Check for double enable
            let customer = await this.store.UserStripeCustomer.findById(ctx, uid);
            if (customer) {
                throw Error('Payments already enabled for user');
            }

            // Create Customer
            await this.store.UserStripeCustomer.create(ctx, uid, { uniqueKey: uuid() });
        });
    }

    applyCustomerId = async (parent: Context, uid: number, customerId: string) => {
        await inTx(parent, async (ctx) => {
            let cust = await this.store.UserStripeCustomer.findById(ctx, uid);
            if (!cust) {
                throw Error('Unable to find customer');
            }
            if (cust.stripeId) {
                return; // Just ignore double customer id persistence
            }
            cust.stripeId = customerId;
        });
    }

    getCustomerId = async (parent: Context, uid: number) => {
        return await inTx(parent, async (ctx: Context) => {
            let cust = (await this.store.UserStripeCustomer.findById(ctx, uid));
            if (!cust) {
                throw Error('Unable to find customer');
            }
            let res = cust.stripeId;
            if (!res) {
                throw Error('Unable to find customer');
            }
            return res;
        });
    }

    //
    // Payment Methods
    //

    addPaymentMethod = async (parent: Context, uid: number, pm: Stripe.PaymentMethod) => {
        if (!pm.card) {
            throw Error('Only cards are allowed');
        }
        return await inTx(parent, async (ctx) => {
            let existing = await this.store.UserStripeCard.findById(ctx, uid, pm.id);
            if (existing) {
                return false;
            }
            let isFirstOne = (await this.store.UserStripeCard.users.findAll(ctx, uid)).length === 0;
            await this.store.UserStripeCard.create(ctx, uid, pm.id, {
                default: isFirstOne,
                deleted: false,
                brand: pm.card!.brand,
                country: pm.card!.country!,
                exp_month: pm.card!.exp_month,
                exp_year: pm.card!.exp_year,
                last4: pm.card!.last4,
                stripeAttached: false,
                stripeDetached: false
            });
            return true;
        });
    }

    removePaymentMethod = async (parent: Context, uid: number, id: string) => {
        return await inTx(parent, async (ctx) => {
            let card = await this.store.UserStripeCard.findById(ctx, uid, id);
            if (!card) {
                throw Error('Card not found');
            }
            if (!card.deleted) {
                card.deleted = true;

                //
                // Update Default
                //

                if (card.default) {
                    card.default = false;

                    let ex = (await this.store.UserStripeCard.users.findAll(ctx, uid)).find((v) => v.pmid !== card!.pmid);
                    if (ex) {
                        ex.default = true;
                    }
                }
                return true;
            }

            return false;
        });
    }

    makePaymentMethodDefault = async (parent: Context, uid: number, id: string) => {
        return await inTx(parent, async (ctx) => {
            let card = await this.store.UserStripeCard.findById(ctx, uid, id);
            if (!card) {
                throw Error('Card not found');
            }

            if (!card.default && !card.deleted) {

                // Remove old default flag
                let ex = (await this.store.UserStripeCard.users.findAll(ctx, uid)).find((v) => v.pmid !== card!.pmid && v.default);
                if (ex) {
                    ex.default = false;
                    await ex.flush(ctx);
                }

                // Set new default
                card.default = true;
                await card.flush(ctx);

                return true;
            }

            return false;
        });
    }

    //
    // Payment Intents
    //

    registerPaymentIntent = async (parent: Context, id: string, amount: number, operation: PaymentIntentCreateShape['operation']) => {
        checkMoney(amount);
        return await inTx(parent, async (ctx) => {
            log.debug(ctx, '[' + id + ']: pending');
            return await this.store.PaymentIntent.create(ctx, id, {
                amount: amount,
                state: 'pending',
                operation: operation
            });
        });
    }

    paymentIntentSuccess = async (parent: Context, id: string) => {
        return await inTx(parent, async (ctx) => {
            let intent = await this.store.PaymentIntent.findById(ctx, id);
            if (!intent) {
                return false;
            }
            if (intent.state !== 'pending') {
                return false;
            }
            log.debug(ctx, '[' + id + ']: ' + intent.state + ' -> success');
            intent.state = 'success';
            return true;
        });
    }

    paymentIntentCancel = async (parent: Context, id: string) => {
        return await inTx(parent, async (ctx) => {
            let intent = await this.store.PaymentIntent.findById(ctx, id);
            if (!intent) {
                return false;
            }
            if (intent.state !== 'pending') {
                return false;
            }
            log.debug(ctx, '[' + id + ']: ' + intent.state + ' -> canceled');
            intent.state = 'canceled';
            return true;
        });
    }
}