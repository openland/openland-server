import { WalletRepository } from './repo/WalletRepository';
import { RoutingRepository } from './repo/RoutingRepository';
import { PaymentsRepository } from './repo/PaymentsRepository';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { PaymentMediator } from './mediators/PaymentMediator';
import { Store } from 'openland-module-db/FDB';
import { Context } from '@openland/context';
import { injectable } from 'inversify';
import { startCustomerExportWorker } from './workers/CustomerExportWorker';
import { startCardSyncWorker } from './workers/CardSyncWorker';
import { startEventsReaderWorker } from './workers/EventsReaderWorker';
import { startPaymentIntentCommiter } from './workers/PaymentIntentCommiter';
import { startPaymentProcessor } from './workers/startPaymentProcessor';

@injectable()
export class BillingModule {

    readonly wallet: WalletRepository = new WalletRepository(Store);
    readonly payments: PaymentsRepository = new PaymentsRepository(Store);
    readonly routing: RoutingRepository = new RoutingRepository(Store, this.wallet);
    readonly paymentsMediator: PaymentMediator = new PaymentMediator('sk_test_bX4FCyKdIBEZZmtdizBGQJpb' /* Like Waaaat 🤯 */,
        this.payments,
        this.routing,
        this.wallet
    );

    start = async () => {
        if (serverRoleEnabled('workers')) {
            startCustomerExportWorker(this.paymentsMediator.createCustomerQueue, this.paymentsMediator);
            startCardSyncWorker(this.paymentsMediator.syncCardQueue, this.paymentsMediator);
            startEventsReaderWorker(this.paymentsMediator);
            startPaymentIntentCommiter(this.paymentsMediator);
            startPaymentProcessor(this.paymentsMediator);
        }
    }

    enableBillingAndAwait = async (parent: Context, uid: number) => {
        return await this.paymentsMediator.enablePaymentsAndAwait(parent, uid);
    }

    registerCard = async (parent: Context, uid: number, pmid: string) => {
        return await this.paymentsMediator.addPaymentMethdod(parent, uid, pmid);
    }

    deleteCard = async (parent: Context, uid: number, pmid: string) => {
        return await this.paymentsMediator.removePaymentMethod(parent, uid, pmid);
    }

    makeCardDefault = async (parent: Context, uid: number, pmid: string) => {
        return await this.paymentsMediator.makePaymentMethodDefault(parent, uid, pmid);
    }

    createSetupIntent = async (parent: Context, uid: number, retryKey: string) => {
        return await this.paymentsMediator.createSetupIntent(parent, uid, retryKey);
    }

    createDepositIntent = async (parent: Context, uid: number, pmid: string, amount: number, retryKey: string) => {
        return await this.paymentsMediator.createDepositIntent(parent, uid, pmid, amount, retryKey);
    }

    updatePaymentIntent = async (parent: Context, id: string) => {
        return await this.paymentsMediator.updatePaymentIntent(parent, id);
    }
}