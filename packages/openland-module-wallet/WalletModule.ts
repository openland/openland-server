import { OperationsRepository } from './repo/OperationsRepository';
import { WalletSubscriptionCreateShape } from '../openland-module-db/store';
import { SubscriptionsRepository } from './repo/SubscriptionsRepository';
import { WalletRepository } from './repo/WalletRepository';
import { RoutingRepository, RoutingRepositoryImpl } from './repo/RoutingRepository';
import { PaymentIntentsRepository } from './repo/PaymentIntentsRepository';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { PaymentMediator } from './mediators/PaymentMediator';
import { Store } from 'openland-module-db/FDB';
import { Context } from '@openland/context';
import { injectable } from 'inversify';
import { startCustomerExportWorker } from './workers/CustomerExportWorker';
import { startCardSyncWorker } from './workers/CardSyncWorker';
import { startEventsReaderWorker } from './workers/EventsReaderWorker';
import { startPaymentIntentCommiter } from './workers/PaymentIntentCommiter';
import { PaymentsRepository } from './repo/PaymentsRepository';
import { startPaymentScheduler } from './workers/startPaymentScheduler';
import { startSubscriptionsScheduler } from './workers/startSubscriptionsScheduler';

@injectable()
export class WalletModule {
    
    // Low level payments repository
    readonly paymentIntents: PaymentIntentsRepository = new PaymentIntentsRepository(Store);
    // Wallet Operations
    readonly wallet: WalletRepository = new WalletRepository(Store);
    // Off-session payments repository
    readonly payments: PaymentsRepository = new PaymentsRepository(Store);
    // Subscriptions repository
    readonly subscriptions: SubscriptionsRepository = new SubscriptionsRepository(Store, this.payments, this.wallet);
    // Routing
    readonly routing: RoutingRepository = new RoutingRepositoryImpl(Store, this.wallet, this.payments, this.subscriptions);
    // Operations repository
    readonly operations: OperationsRepository = new OperationsRepository(Store, this.wallet, this.payments, this.subscriptions);

    // Payments Mediator (on/off session)
    readonly paymentsMediator: PaymentMediator = new PaymentMediator('sk_test_bX4FCyKdIBEZZmtdizBGQJpb' /* Like Waaaat 🤯 */,
        this.paymentIntents, this.payments
    );

    constructor() {
        this.subscriptions.setRouting(this.routing);
        this.payments.setRouting(this.routing);
        this.paymentIntents.setRouting(this.routing);
    }

    start = async () => {
        if (serverRoleEnabled('workers')) {
            startCustomerExportWorker(this.paymentsMediator.createCustomerQueue, this.paymentsMediator);
            startCardSyncWorker(this.paymentsMediator.syncCardQueue, this.paymentsMediator);
            startEventsReaderWorker(this.paymentsMediator);
            startPaymentIntentCommiter(this.paymentsMediator);
            startPaymentScheduler(this.paymentsMediator);
            startSubscriptionsScheduler(this.subscriptions, this.paymentsMediator);
        }
    }

    //
    // Payments
    //

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

    updatePaymentIntent = async (parent: Context, id: string) => {
        return await this.paymentsMediator.updatePaymentIntent(parent, id);
    }

    //
    // Deposits
    //

    createDepositIntent = async (parent: Context, uid: number, pmid: string, amount: number, retryKey: string) => {
        return await this.paymentsMediator.createDepositIntent(parent, uid, pmid, amount, retryKey);
    }

    createDepositPayment = async (parent: Context, uid: number, amount: number, retryKey: string) => {
        return await this.operations.createDepositPayment(parent, uid, amount, retryKey);
    }

    //
    // Subscription
    //

    createSubscription = async (parent: Context, uid: number, amount: number, interval: 'week' | 'month', product: WalletSubscriptionCreateShape['proudct']) => {
        return await this.operations.createSubscription(parent, uid, amount, interval, product);
    }

    //
    // Transfers
    //

    createTransferPayment = async (parent: Context, fromUid: number, toUid: number, amount: number, retryKey: string) => {
        return await this.operations.createTransferPayment(parent, fromUid, toUid, amount, retryKey);
    }
}