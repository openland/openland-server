import { WalletRepository } from './WalletRepository';
import { Context } from '@openland/context';
import { Store, PaymentIntentCreateShape } from './../../openland-module-db/store';
import { SubscriptionsRepository } from './SubscriptionsRepository';

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
            await this.wallet.subscriptionPaymentFailing(ctx, operation.uid, operation.txid);

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
            await this.wallet.subscriptionPaymentActionNeeded(ctx, operation.uid, operation.txid);

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
        //
    }

    /**
     * Recovered from failing state
     */
    onSubscriptionRecovered = async (ctx: Context, id: string) => {
        //
    }

    /**
     * Grace Period expired - pause subscription
     */
    onSubscriptionPaused = async (ctx: Context, id: string) => {
        //
    }

    /**
     * Subscription restarted
     */
    onSubscriptionRestarted = async (ctx: Context, id: string) => {
        //
    }

    /**
     * Subscription ended
     */
    onSubscriptionExpired = async (ctx: Context, id: string) => {
        //
    }

    /**
     * Subscription canceled, but not expired yet
     */
    onSubscriptionCanceled = async (ctx: Context, id: string) => {
        //
    }
}

export type RoutingRepository = Partial<RoutingRepositoryImpl>;