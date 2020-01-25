import { BillingRepository } from './BillingRepository';
import { Context } from '@openland/context';
import { Store, PaymentIntentCreateShape } from './../../openland-module-db/store';

export class RoutingRepository {

    readonly repo: BillingRepository;
    readonly store: Store;

    constructor(store: Store, repo: BillingRepository) {
        this.store = store;
        this.repo = repo;
    }

    routeSuccessfulPayment = async (ctx: Context, amount: number, operation: PaymentIntentCreateShape['operation']) => {
        if (operation.type === 'deposit') {

            // Create and confirm transaction
            let tx = await this.repo.createTransaction(
                ctx, null, operation.uid, 'deposit', amount
            );
            await this.repo.confirmTransaction(ctx, tx.id);

        } else if (operation.type === 'subscription') {
            // TODO: Implement
            // throw Error('Invalid intent');
        }
    }
}