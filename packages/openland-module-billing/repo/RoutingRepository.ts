import { WalletRepository } from './WalletRepository';
import { Context } from '@openland/context';
import { Store, PaymentIntentCreateShape } from './../../openland-module-db/store';
import { SubscriptionsRepository } from './SubscriptionsRepository';
import { Modules } from 'openland-modules/Modules';

export class RoutingRepositoryImpl {

    readonly store: Store;
    readonly wallet: WalletRepository;
    readonly subscriptions: SubscriptionsRepository;

    constructor(store: Store, wallet: WalletRepository, subscriptions: SubscriptionsRepository) {
        this.store = store;
        this.wallet = wallet;
        this.subscriptions = subscriptions;
    }

    //
    // Off-Session Payments
    //

    routeSuccessfulPayment = async (ctx: Context, amount: number, pid: string, operation: PaymentIntentCreateShape['operation']) => {
        if (operation.type === 'deposit') {
            if (!operation.txid) {
                throw Error('Transaction ID is missing');
            }

            // Confirm existing transaction
            await this.wallet.depositAsyncCommit(ctx, operation.uid, operation.txid);
        } else if (operation.type === 'subscription') {

            // Update Wallet
            await this.wallet.subscriptionPaymentCommit(ctx, operation.uid, operation.txid);

            // Update Subscription
            await this.subscriptions.handlePaymentSuccess(ctx, operation.uid, operation.subscription, operation.period);

        } else if (operation.type === 'transfer') {
            await this.wallet.transferAsyncCommit(ctx, operation.fromUid, operation.fromTx, operation.toUid, operation.toTx);
        } else {
            throw Error('Unknown operation type');
        }
    }

    routeFailingPayment = async (ctx: Context, amount: number, pid: string, operation: PaymentIntentCreateShape['operation']) => {
        if (operation.type === 'deposit') {
            if (!operation.txid) {
                throw Error('Transaction ID is missing');
            }

            // Change payment status
            await this.wallet.depositAsyncFailing(ctx, operation.uid, operation.txid);
        } else if (operation.type === 'subscription') {

            // Update Wallet
            await this.wallet.subscriptionPaymentFailing(ctx, operation.uid, operation.txid, pid);

            // Update subscription
            await this.subscriptions.handlePaymentFailing(ctx, operation.uid, operation.subscription, operation.period);

        } else if (operation.type === 'transfer') {
            await this.wallet.transferAsyncFailing(ctx, operation.fromUid, operation.fromTx, operation.toUid, operation.toTx, pid);
        } else {
            throw Error('Unknown operation type');
        }
    }

    routeActionNeededPayment = async (ctx: Context, amount: number, pid: string, operation: PaymentIntentCreateShape['operation']) => {
        if (operation.type === 'deposit') {
            if (!operation.txid) {
                throw Error('Transaction ID is missing');
            }

            // Change payment status
            await this.wallet.depositAsyncActionNeeded(ctx, operation.uid, operation.txid);
        } else if (operation.type === 'subscription') {

            // Update Wallet
            await this.wallet.subscriptionPaymentActionNeeded(ctx, operation.uid, operation.txid, pid);

            // Update subscription
            await this.subscriptions.handlePaymentFailing(ctx, operation.uid, operation.subscription, operation.period);
        } else if (operation.type === 'transfer') {
            await this.wallet.transferAsyncActionNeeded(ctx, operation.fromUid, operation.fromTx, operation.toUid, operation.toTx, pid);
        } else {
            throw Error('Unknown operation type');
        }
    }

    routeCanceledPayment = async (ctx: Context, amount: number, pid: string, operation: PaymentIntentCreateShape['operation']) => {
        if (operation.type === 'deposit') {
            if (!operation.txid) {
                throw Error('Transaction ID is missing');
            }

            // Confirm existing transaction
            await this.wallet.depositAsyncCancel(ctx, operation.uid, operation.txid);
        } else if (operation.type === 'subscription') {

            // Update Wallet
            await this.wallet.subscriptionPaymentCancel(ctx, operation.uid, operation.txid);

            // Update subscription
            await this.subscriptions.handlePaymentCanceled(ctx, operation.uid, operation.subscription, operation.period);
        } else if (operation.type === 'transfer') {
            await this.wallet.transferAsyncCancel(ctx, operation.fromUid, operation.fromTx, operation.toUid, operation.toTx);
        } else {
            throw Error('Unknown operation type');
        }
    }

    //
    // On-Session Payment Intents
    //

    routeSuccessfulPaymentIntent = async (ctx: Context, amount: number, operation: PaymentIntentCreateShape['operation']) => {
        if (operation.type === 'deposit') {
            await this.wallet.depositInstant(ctx, operation.uid, amount);
        } else {
            throw Error('Unknown operation type');
        }
    }

    //
    // Subscriptions
    //

    /**
     * Payment failing, but subscription is still alive
     */
    onSubscriptionFailing = async (ctx: Context, id: string) => {
        let subscription = await this.store.WalletSubscription.findById(ctx, id);
        if (subscription && subscription.proudct.type === 'group') {
            await Modules.Messaging.proChat.onSubscriptionFailing(ctx, subscription.id, subscription.proudct.gid, subscription.uid);
        }
    }

    /**
     * Payment Period success
     */
    onSubscriptionPaymentSuccess = async (ctx: Context, id: string, index: number) => {
        let subscription = await this.store.WalletSubscription.findById(ctx, id);
        if (subscription && subscription.proudct.type === 'group') {
            await Modules.Messaging.proChat.onSubscriptionPaymentSuccess(ctx, subscription.id, subscription.proudct.gid, subscription.uid);
        }
    }

    /**
     * Recovered from failing state
     */
    onSubscriptionRecovered = async (ctx: Context, id: string) => {
        let subscription = await this.store.WalletSubscription.findById(ctx, id);
        if (subscription && subscription.proudct.type === 'group') {
            await Modules.Messaging.proChat.onSubscriptionRecovered(ctx, subscription.id, subscription.proudct.gid, subscription.uid);
        }
    }

    /**
     * Grace Period expired - pause subscription
     */
    onSubscriptionPaused = async (ctx: Context, id: string) => {
        let subscription = await this.store.WalletSubscription.findById(ctx, id);
        if (subscription && subscription.proudct.type === 'group') {
            await Modules.Messaging.proChat.onSubscriptionPaused(ctx, subscription.id, subscription.proudct.gid, subscription.uid);
        }
    }

    /**
     * Subscription restarted
     */
    onSubscriptionRestarted = async (ctx: Context, id: string) => {
        let subscription = await this.store.WalletSubscription.findById(ctx, id);
        if (subscription && subscription.proudct.type === 'group') {
            await Modules.Messaging.proChat.onSubscriptionRestarted(ctx, subscription.id, subscription.proudct.gid, subscription.uid);
        }
    }

    /**
     * Subscription ended
     */
    onSubscriptionExpired = async (ctx: Context, id: string) => {
        let subscription = await this.store.WalletSubscription.findById(ctx, id);
        if (subscription && subscription.proudct.type === 'group') {
            await Modules.Messaging.proChat.onSubscriptionExpired(ctx, subscription.id, subscription.proudct.gid, subscription.uid);
        }
    }

    /**
     * Subscription canceled, but not expired yet
     */
    onSubscriptionCanceled = async (ctx: Context, id: string) => {
        let subscription = await this.store.WalletSubscription.findById(ctx, id);
        if (subscription && subscription.proudct.type === 'group') {
            await Modules.Messaging.proChat.onSubscriptionCanceled(ctx, subscription.id, subscription.proudct.gid, subscription.uid);
        }
    }
}

export type RoutingRepository = Partial<RoutingRepositoryImpl>;