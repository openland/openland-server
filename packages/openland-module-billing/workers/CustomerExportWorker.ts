import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { Store } from 'openland-module-db/FDB';
import Stripe from 'stripe';

export function startCustomerExportWorker(queue: WorkQueue<{ uid: number, idempotencyKey: string }, { result: string }>, token: string) {

    let stripe = new Stripe(token, { apiVersion: '2019-12-03', typescript: true });
    queue.addWorker(async (item, ctx) => {

        // Load User
        let user = await Store.User.findById(ctx, item.uid);
        if (!user) {
            throw Error('Unable to create customer without user');
        }

        // Load Profile
        let profile = await Store.UserProfile.findById(ctx, item.uid);
        if (!profile) {
            throw Error('Unable to create customer without profile');
        }

        // Customer Record
        let customer = await Store.UserStripeCustomer.findById(ctx, item.uid);
        if (!customer) {
            throw Error('Unable to create customer without customer record');
        }

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
        let stripeCustomer = await stripe.customers.create({
            email: user.email,
            name: (profile.firstName + ' ' + (profile.lastName || '')).trim(),
            metadata: { uid: item.uid }
        }, { idempotencyKey: item.idempotencyKey });

        // Save result
        customer.stripeId = stripeCustomer.id;

        return { result: 'ok' };
    });
}