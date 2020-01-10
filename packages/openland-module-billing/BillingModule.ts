import { Store } from 'openland-module-db/FDB';
import { BillingRepository } from './repo/BillingRepository';
import { Context } from '@openland/context';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { injectable } from 'inversify';
import { startCustomerExportWorker } from './workers/CustomerExportWorker';

@injectable()
export class BillingModule {

    readonly createCustomerQueue = new WorkQueue<{ uid: number, idempotencyKey: string }, { result: string }>('stripe-customer-export-task', -1);
    readonly repo: BillingRepository = new BillingRepository(Store);

    start = async () => {
        // Start Workers
        startCustomerExportWorker(this.createCustomerQueue, 'sk_test_bX4FCyKdIBEZZmtdizBGQJpb' /* Like Waaaat 🤯 */);
    }

    enableBilling = async (parent: Context, uid: number) => {
        return await this.repo.enableBilling(parent, uid);
    }
}