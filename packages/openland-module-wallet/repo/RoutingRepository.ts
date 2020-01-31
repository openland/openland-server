import { WalletRepository } from './WalletRepository';
import { Context } from '@openland/context';
import { Store, PaymentIntentCreateShape, PaymentCreateShape } from '../../openland-module-db/store';
import { SubscriptionsRepository } from './SubscriptionsRepository';
import { Modules } from 'openland-modules/Modules';
import { PaymentsRepository } from './PaymentsRepository';

export class RoutingRepositoryImpl {

    readonly store: Store;
    readonly wallet: WalletRepository;
    readonly payments: PaymentsRepository;
    readonly subscriptions: SubscriptionsRepository;

    constructor(store: Store, wallet: WalletRepository, payments: PaymentsRepository, subscriptions: SubscriptionsRepository) {
        this.store = store;
        this.wallet = wallet;
        this.payments = payments;
        this.subscriptions = subscriptions;
    }

    //
    // Payment Events
    //

    onPaymentSuccess = async (ctx: Context, amount: number, pid: string, operation: PaymentCreateShape['operation']) => {
        if (operation.type === 'deposit') {
            await this.wallet.depositAsyncCommit(ctx, operation.uid, operation.txid);
        } else if (operation.type === 'subscription') {
            await this.wallet.subscriptionPaymentCommit(ctx, operation.uid, operation.txid);
            await this.subscriptions.handlePaymentSuccess(ctx, operation.uid, operation.subscription, operation.period, pid, Date.now());
        } else if (operation.type === 'transfer') {
            await this.wallet.transferAsyncCommit(ctx, operation.fromUid, operation.fromTx, operation.toUid, operation.toTx);
        } else {
            throw Error('Unknown operation type');
        }
    }

    onPaymentFailing = async (ctx: Context, amount: number, pid: string, operation: PaymentCreateShape['operation']) => {
        if (operation.type === 'deposit') {
            await this.wallet.depositAsyncFailing(ctx, operation.uid, operation.txid);
        } else if (operation.type === 'subscription') {
            await this.wallet.subscriptionPaymentFailing(ctx, operation.uid, operation.txid, pid);
            await this.subscriptions.handlePaymentFailing(ctx, operation.uid, operation.subscription, operation.period, pid, Date.now());
        } else if (operation.type === 'transfer') {
            await this.wallet.transferAsyncFailing(ctx, operation.fromUid, operation.fromTx, operation.toUid, operation.toTx, pid);
        } else {
            throw Error('Unknown operation type');
        }
    }

    onPaymentActionNeeded = async (ctx: Context, amount: number, pid: string, operation: PaymentCreateShape['operation']) => {
        if (operation.type === 'deposit') {
            await this.wallet.depositAsyncActionNeeded(ctx, operation.uid, operation.txid);
        } else if (operation.type === 'subscription') {
            await this.wallet.subscriptionPaymentActionNeeded(ctx, operation.uid, operation.txid, pid);
            await this.subscriptions.handlePaymentFailing(ctx, operation.uid, operation.subscription, operation.period, pid, Date.now());
        } else if (operation.type === 'transfer') {
            await this.wallet.transferAsyncActionNeeded(ctx, operation.fromUid, operation.fromTx, operation.toUid, operation.toTx, pid);
        } else {
            throw Error('Unknown operation type');
        }
    }

    onPaymentCanceled = async (ctx: Context, amount: number, pid: string, operation: PaymentCreateShape['operation']) => {
        if (operation.type === 'deposit') {
            await this.wallet.depositAsyncCancel(ctx, operation.uid, operation.txid);
        } else if (operation.type === 'subscription') {
            await this.wallet.subscriptionPaymentCancel(ctx, operation.uid, operation.txid);
            await this.subscriptions.handlePaymentCanceled(ctx, operation.uid, operation.subscription, operation.period, pid, Date.now());
        } else if (operation.type === 'transfer') {
            await this.wallet.transferAsyncCancel(ctx, operation.fromUid, operation.fromTx, operation.toUid, operation.toTx);
        } else {
            throw Error('Unknown operation type');
        }
    }

    //
    // Subscription Events
    //

    /**
     * Subscription is started
     */
    onSubscriptionStarted = async (ctx: Context, id: string) => {
        // TODO: Implement
    }

    /**
     * Payment failing, but subscription is still alive
     */
    onSubscriptionFailing = async (ctx: Context, id: string) => {
        let subscription = await this.store.WalletSubscription.findById(ctx, id);
        if (subscription && subscription.proudct.type === 'group') {
            await Modules.Messaging.premiumChat.onSubscriptionFailing(ctx, subscription.id, subscription.proudct.gid, subscription.uid);
        }
    }

    /**
     * Payment Period success
     */
    onSubscriptionPaymentSuccess = async (ctx: Context, id: string, index: number) => {
        let subscription = await this.store.WalletSubscription.findById(ctx, id);
        if (subscription && subscription.proudct.type === 'group') {
            await Modules.Messaging.premiumChat.onSubscriptionPaymentSuccess(ctx, subscription.id, subscription.proudct.gid, subscription.uid);
        }
    }

    /**
     * Recovered from failing state
     */
    onSubscriptionRecovered = async (ctx: Context, id: string) => {
        let subscription = await this.store.WalletSubscription.findById(ctx, id);
        if (subscription && subscription.proudct.type === 'group') {
            await Modules.Messaging.premiumChat.onSubscriptionRecovered(ctx, subscription.id, subscription.proudct.gid, subscription.uid);
        }
    }

    /**
     * Grace Period expired - pause subscription
     */
    onSubscriptionPaused = async (ctx: Context, id: string) => {
        let subscription = await this.store.WalletSubscription.findById(ctx, id);
        if (subscription && subscription.proudct.type === 'group') {
            await Modules.Messaging.premiumChat.onSubscriptionPaused(ctx, subscription.id, subscription.proudct.gid, subscription.uid);
        }
    }

    /**
     * Subscription restarted
     */
    onSubscriptionRestarted = async (ctx: Context, id: string) => {
        let subscription = await this.store.WalletSubscription.findById(ctx, id);
        if (subscription && subscription.proudct.type === 'group') {
            await Modules.Messaging.premiumChat.onSubscriptionRestarted(ctx, subscription.id, subscription.proudct.gid, subscription.uid);
        }
    }

    /**
     * Subscription ended
     */
    onSubscriptionExpired = async (ctx: Context, id: string) => {
        let subscription = await this.store.WalletSubscription.findById(ctx, id);
        if (subscription && subscription.proudct.type === 'group') {
            await Modules.Messaging.premiumChat.onSubscriptionExpired(ctx, subscription.id, subscription.proudct.gid, subscription.uid);
        }
    }

    /**
     * Subscription canceled, but not expired yet
     */
    onSubscriptionCanceled = async (ctx: Context, id: string) => {
        let subscription = await this.store.WalletSubscription.findById(ctx, id);
        if (subscription && subscription.proudct.type === 'group') {
            await Modules.Messaging.premiumChat.onSubscriptionCanceled(ctx, subscription.id, subscription.proudct.gid, subscription.uid);
        }
    }

    //
    // Payment Intent Events
    //

    onPaymentIntentSuccess = async (ctx: Context, amount: number, operation: PaymentIntentCreateShape['operation']) => {
        if (operation.type === 'deposit') {
            await this.wallet.depositInstant(ctx, operation.uid, amount);
        } else if (operation.type === 'payment') {
            await this.payments.handlePaymentIntentSuccess(ctx, operation.id);
        } else {
            throw Error('Unknown operation type');
        }
    }

    onPaymentIntentCanceled = async (ctx: Context, amount: number, operation: PaymentIntentCreateShape['operation']) => {
        if (operation.type === 'deposit') {
            // Nothing To Do
        } else if (operation.type === 'payment') {
            await this.payments.handlePaymentIntentCanceled(ctx, operation.id);
        } else {
            throw Error('Unknown operation type');
        }
    }

    onPaymentIntentNeedAction = async (ctx: Context, amount: number, operation: PaymentIntentCreateShape['operation']) => {
        if (operation.type === 'deposit') {
            // Nothing To Do
        } else if (operation.type === 'payment') {
            await this.payments.handlePaymentActionRequired(ctx, operation.id);
        } else {
            throw Error('Unknown operation type');
        }
    }

    onPaymentIntentFailing = async (ctx: Context, amount: number, operation: PaymentIntentCreateShape['operation']) => {
        if (operation.type === 'deposit') {
            // Nothing To Do
        } else if (operation.type === 'payment') {
            await this.payments.handlePaymentFailing(ctx, operation.id);
        } else {
            throw Error('Unknown operation type');
        }
    }
}

export type RoutingRepository = Partial<RoutingRepositoryImpl>;