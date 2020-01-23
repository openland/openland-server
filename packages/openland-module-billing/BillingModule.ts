import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { StripeMediator } from './mediators/StripeMediator';
import { Store } from 'openland-module-db/FDB';
import { BillingRepository } from './repo/BillingRepository';
import { Context } from '@openland/context';
import { injectable } from 'inversify';
import { startCustomerExportWorker } from './workers/CustomerExportWorker';
import { startCardSyncWorker } from './workers/CardSyncWorker';
import { startEventsReaderWorker } from './workers/EventsReaderWorker';
import { startPaymentIntentCommiter } from './workers/PaymentIntentCommiter';

@injectable()
export class BillingModule {

    readonly repo: BillingRepository = new BillingRepository(Store);
    readonly stripeMediator: StripeMediator = new StripeMediator('sk_test_bX4FCyKdIBEZZmtdizBGQJpb' /* Like Waaaat 🤯 */, this.repo);

    start = async () => {
        if (serverRoleEnabled('workers')) {
            startCustomerExportWorker(this.repo.createCustomerQueue, this.stripeMediator);
            startCardSyncWorker(this.repo.syncCardQueue, this.stripeMediator);
            startEventsReaderWorker(this.stripeMediator);
            startPaymentIntentCommiter(this.stripeMediator);
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

    deleteCard = async (parent: Context, uid: number, pmid: string) => {
        return await this.stripeMediator.deleteCard(parent, uid, pmid);
    }

    makeCardDefault = async (parent: Context, uid: number, pmid: string) => {
        return await this.stripeMediator.makeCardDefault(parent, uid, pmid);
    }

    createSetupIntent = async (parent: Context, uid: number, retryKey: string) => {
        return await this.stripeMediator.createSetupIntent(parent, uid, retryKey);
    }

    createDepositIntent = async (parent: Context, uid: number, pmid: string, amount: number, retryKey: string) => {
        return await this.stripeMediator.createDepositIntent(parent, uid, pmid, amount, retryKey);
    }

    updatePaymentIntent = async (parent: Context, id: string) => {
        return await this.stripeMediator.updatePaymentIntent(parent, id);
    }
}