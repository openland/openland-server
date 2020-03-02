import { WalletPurchaseCreateShape } from './../openland-module-db/store';
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
import { PurchaseRepository } from './repo/PurchaseRepository';
import { inTx } from '@openland/foundationdb';
import { UserError } from 'openland-errors/UserError';

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
    // Purchases repository
    readonly purchases: PurchaseRepository = new PurchaseRepository(Store, this.wallet, this.payments);
    // Routing
    readonly routing: RoutingRepository = new RoutingRepositoryImpl(Store, this.wallet, this.payments, this.subscriptions, this.purchases);
    // Operations repository
    readonly operations: OperationsRepository = new OperationsRepository(Store, this.wallet, this.payments, this.subscriptions);

    // Payments Mediator (on/off session)
    readonly paymentsMediator: PaymentMediator = new PaymentMediator(process.env.STRIPE_SK  || 'sk_test_bX4FCyKdIBEZZmtdizBGQJpb' /* Like Waaaat 🤯 */,
        this.paymentIntents, this.payments, this.subscriptions
    );

    constructor() {
        this.subscriptions.setRouting(this.routing);
        this.payments.setRouting(this.routing);
        this.paymentIntents.setRouting(this.routing);
        this.purchases.setRouting(this.routing);
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
    // Wallet
    //

    getWallet = async (parent: Context, uid: number) => {
        return await this.wallet.getWallet(parent, uid);
    }

    isLocked = async (parent: Context, uid: number) => {
        return await this.wallet.isLocked(parent, uid);
    }

    getFailingPaymentsCount = async (parent: Context, uid: number) => {
        return await this.wallet.getFailingPaymentsCount(parent, uid);
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
        return await inTx(parent, async (ctx) => {
            if (await this.wallet.isLocked(ctx, uid)) {
                throw new UserError('Wallet is locked dew to failing transactions');
            }
            return await this.operations.createSubscription(ctx, uid, amount, interval, product);

        });
    }

    cancelSubscription = async (parent: Context, id: string) => {
        await this.paymentsMediator.cancelSubscription(parent, id);
    }

    //
    // Transfers
    //

    createTransferPayment = async (parent: Context, fromUid: number, toUid: number, amount: number, retryKey: string) => {
        return await this.operations.createTransferPayment(parent, fromUid, toUid, amount, retryKey);
    }

    //
    // Purchases
    //

    createPurchase = async (parent: Context, uid: number, amount: number, product: WalletPurchaseCreateShape['product']) => {
        return await inTx(parent, async (ctx) => {
            if (await this.wallet.isLocked(ctx, uid)) {
                throw new UserError('Wallet is locked dew to failing transactions');
            }
            return await this.purchases.createPurchase(ctx, uid, amount, product);
        });
    }

    // getPurchaseIntent = async (parent: Context, id: string) => {

    // }
}
