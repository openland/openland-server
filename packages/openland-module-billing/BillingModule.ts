import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { StripeMediator } from './mediators/StripeMediator';
import { Store } from 'openland-module-db/FDB';
import { BillingRepository } from './repo/BillingRepository';
import { Context } from '@openland/context';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { injectable } from 'inversify';
import { startCustomerExportWorker } from './workers/CustomerExportWorker';
import { startCardSyncWorker } from './workers/CardSyncWorker';

@injectable()
export class BillingModule {

    readonly createCustomerQueue = new WorkQueue<{ uid: number }, { result: string }>('stripe-customer-export-task', -1);
    readonly cardSyncQueue = new WorkQueue<{ uid: number, pmid: string }, { result: string }>('stripe-customer-export-card-task', -1);
    readonly repo: BillingRepository = new BillingRepository(Store, this.createCustomerQueue, this.cardSyncQueue);
    readonly stripeMediator: StripeMediator = new StripeMediator('sk_test_bX4FCyKdIBEZZmtdizBGQJpb' /* Like Waaaat 🤯 */, this.repo);

    start = async () => {
        if (serverRoleEnabled('workers')) {
            startCustomerExportWorker(this.createCustomerQueue, this.stripeMediator);
            startCardSyncWorker(this.cardSyncQueue, this.stripeMediator);
        }
    }

    enableBilling = async (parent: Context, uid: number) => {
        return await this.repo.enableBilling(parent, uid);
    }

    enableBillingAndAwait = async (parent: Context, uid: number) => {
        return await this.stripeMediator.enableBillingAndAwait(parent, uid);
    }

    registerCard = async (parent: Context, uid: number, pmid: string) => {
        return await this.stripeMediator.registerCard(parent, uid, pmid);
    }
}