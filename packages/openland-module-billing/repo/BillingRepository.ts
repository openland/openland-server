import { uuid } from 'openland-utils/uuid';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { Store } from './../../openland-module-db/store';

export class BillingRepository {
    private readonly store: Store;

    readonly createCustomerQueue = new WorkQueue<{ uid: number, idempotencyKey: string }, { result: string }>('stripe-customer-export-task', -1);

    constructor(store: Store) {
        this.store = store;
    }

    enableBilling = async (parent: Context, uid: number) => {
        return await inTx(parent, async (ctx) => {

            // Check if user exists
            let user = await this.store.User.findById(ctx, uid);
            if (!user) {
                throw Error('Unable to find user');
            }

            // Check if profile exists
            let profile = await this.store.UserProfile.findById(ctx, uid);
            if (!profile) {
                throw Error('Unable to enable billing without profile');
            }

            // Check for double enable
            let customer = await this.store.UserStripeCustomer.findById(ctx, uid);
            if (customer) {
                throw Error('Billing already enabled for user');
            }

            // Create Customer
            await this.store.UserStripeCustomer.create(ctx, uid, {});

            // Schedule work to register customer
            await this.createCustomerQueue.pushWork(ctx, { uid, idempotencyKey: uuid() });
        });
    }
}