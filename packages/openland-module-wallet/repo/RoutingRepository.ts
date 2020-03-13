import { WalletPurchaseCreateShape, WalletSubscription } from './../../openland-module-db/store';
import { WalletRepository } from './WalletRepository';
import { Context } from '@openland/context';
import { Store, PaymentIntentCreateShape, PaymentCreateShape } from '../../openland-module-db/store';
import { SubscriptionsRepository } from './SubscriptionsRepository';
import { Modules } from 'openland-modules/Modules';
import { PaymentsRepository } from './PaymentsRepository';
import { PurchaseRepository } from './PurchaseRepository';
import { createHyperlogger } from '../../openland-module-hyperlog/createHyperlogEvent';

const walletEvent = createHyperlogger<{ type: string, body: any }>('wallet_event');

const subscriptionToEvent = (s: WalletSubscription) => ({
    id: s.id,
    uid: s.uid,
    amount: s.amount,
    interval: s.interval,
    start: s.start,
    proudct: s.proudct,
    state: s.state
});

export class RoutingRepositoryImpl {

    readonly store: Store;
    readonly wallet: WalletRepository;
    readonly payments: PaymentsRepository;
    readonly subscriptions: SubscriptionsRepository;
    readonly purchases: PurchaseRepository;

    constructor(store: Store, wallet: WalletRepository, payments: PaymentsRepository, subscriptions: SubscriptionsRepository, purchases: PurchaseRepository) {
        this.store = store;
        this.wallet = wallet;
        this.payments = payments;
        this.subscriptions = subscriptions;
        this.purchases = purchases;
    }

    //
    // Payment Events
    //

    onPaymentSuccess = async (ctx: Context, uid: number, amount: number, pid: string, operation: PaymentCreateShape['operation']) => {
        await walletEvent.event(ctx, { type: 'payment_success', body: { uid, amount, pid, operation } });

        if (operation.type === 'deposit') {
            await this.wallet.depositAsyncCommit(ctx, operation.uid, operation.txid);
            await this.wallet.updateIsLocked(ctx, operation.uid);
        } else if (operation.type === 'subscription') {
            await this.wallet.subscriptionPaymentCommit(ctx, operation.uid, operation.txid);
            await this.subscriptions.handlePaymentSuccess(ctx, operation.uid, operation.txid, operation.subscription, operation.period, pid, Date.now());
            await this.wallet.updateIsLocked(ctx, operation.uid);
        } else if (operation.type === 'transfer') {
            await this.wallet.transferAsyncCommit(ctx, operation.fromUid, operation.fromTx, operation.toUid, operation.toTx);
            await this.wallet.updateIsLocked(ctx, operation.fromUid);
        } else if (operation.type === 'purchase') {
            await this.purchases.onPurchaseSuccessful(ctx, operation.id);
            await this.wallet.updateIsLocked(ctx, uid);
        } else {
            throw Error('Unknown operation type');
        }

        await Modules.Hooks.onPaymentSuccess(ctx, uid, amount);
    }

    onPaymentFailing = async (ctx: Context, uid: number, amount: number, pid: string, operation: PaymentCreateShape['operation']) => {
        await walletEvent.event(ctx, { type: 'payment_failing', body: { uid, amount, pid, operation } });

        if (operation.type === 'deposit') {
            await this.wallet.depositAsyncFailing(ctx, operation.uid, operation.txid);
            await this.wallet.updateIsLocked(ctx, operation.uid);
        } else if (operation.type === 'subscription') {
            await this.wallet.subscriptionPaymentFailing(ctx, operation.uid, operation.txid, pid);
            await this.subscriptions.handlePaymentFailing(ctx, operation.uid, operation.subscription, operation.period, pid, Date.now());
            await this.wallet.updateIsLocked(ctx, operation.uid);
        } else if (operation.type === 'transfer') {
            await this.wallet.transferAsyncFailing(ctx, operation.fromUid, operation.fromTx, operation.toUid, operation.toTx, pid);
            await this.wallet.updateIsLocked(ctx, operation.fromUid);
        } else if (operation.type === 'purchase') {
            await this.purchases.onPurchaseFailing(ctx, operation.id);
            await this.wallet.updateIsLocked(ctx, uid);
        } else {
            throw Error('Unknown operation type');
        }
    }

    onPaymentActionNeeded = async (ctx: Context, uid: number, amount: number, pid: string, operation: PaymentCreateShape['operation']) => {
        await walletEvent.event(ctx, { type: 'payment_action_needed', body: { uid, amount, pid, operation } });

        if (operation.type === 'deposit') {
            await this.wallet.depositAsyncActionNeeded(ctx, operation.uid, operation.txid);
            await this.wallet.updateIsLocked(ctx, operation.uid);
        } else if (operation.type === 'subscription') {
            await this.wallet.subscriptionPaymentActionNeeded(ctx, operation.uid, operation.txid, pid);
            await this.subscriptions.handlePaymentFailing(ctx, operation.uid, operation.subscription, operation.period, pid, Date.now());
            await this.wallet.updateIsLocked(ctx, operation.uid);
        } else if (operation.type === 'transfer') {
            await this.wallet.transferAsyncActionNeeded(ctx, operation.fromUid, operation.fromTx, operation.toUid, operation.toTx, pid);
            await this.wallet.updateIsLocked(ctx, operation.fromUid);
        } else if (operation.type === 'purchase') {
            await this.purchases.onPurchaseNeedAction(ctx, operation.id);
            await this.wallet.updateIsLocked(ctx, uid);
        } else {
            throw Error('Unknown operation type');
        }
    }

    onPaymentCanceled = async (ctx: Context, uid: number, amount: number, pid: string, operation: PaymentCreateShape['operation']) => {
        await walletEvent.event(ctx, { type: 'payment_canceled', body: { uid, amount, pid, operation } });

        if (operation.type === 'deposit') {
            await this.wallet.depositAsyncCancel(ctx, operation.uid, operation.txid);
            await this.wallet.updateIsLocked(ctx, operation.uid);
        } else if (operation.type === 'subscription') {
            await this.wallet.subscriptionPaymentCancel(ctx, operation.uid, operation.txid);
            await this.subscriptions.handlePaymentCanceled(ctx, operation.uid, operation.subscription, operation.period, pid, Date.now());
            await this.wallet.updateIsLocked(ctx, operation.uid);
        } else if (operation.type === 'transfer') {
            await this.wallet.transferAsyncCancel(ctx, operation.fromUid, operation.fromTx, operation.toUid, operation.toTx);
            await this.wallet.updateIsLocked(ctx, operation.fromUid);
        } else if (operation.type === 'purchase') {
            await this.purchases.onPurchaseCanceled(ctx, operation.id);
            await this.wallet.updateIsLocked(ctx, uid);
        } else {
            throw Error('Unknown operation type');
        }
    }

    //
    // Purchase Events
    //

    onPurchaseCreated = async (ctx: Context, pid: string, txid: string, uid: number, amount: number, product: WalletPurchaseCreateShape['product']) => {
        await walletEvent.event(ctx, { type: 'purchase_created', body: { pid, uid, amount, product } });
        if (product.type === 'group') {
            await Modules.Messaging.premiumChat.onPurchaseCreated(ctx, pid, txid, uid, amount, product.gid);
        }
    }

    onPurchaseSuccessful = async (ctx: Context, pid: string, txid: string, uid: number, amount: number, product: WalletPurchaseCreateShape['product']) => {
        await walletEvent.event(ctx, { type: 'purchase_successful', body: { pid, uid, amount, product } });
        if (product.type === 'group') {
            await Modules.Messaging.premiumChat.onPurchaseSuccess(ctx, pid, txid, product.gid, uid, amount);
        }
    }

    onPurchaseFailing = async (ctx: Context, pid: string, uid: number, amount: number, product: WalletPurchaseCreateShape['product']) => {
        await walletEvent.event(ctx, { type: 'purchase_failing', body: { pid, uid, amount, product } });
        if (product.type === 'group') {
            await Modules.Messaging.premiumChat.onPurchaseFailing(ctx, pid, product.gid, uid, amount);
        }
    }

    onPurchaseNeedAction = async (ctx: Context, pid: string, uid: number, amount: number, product: WalletPurchaseCreateShape['product']) => {
        await walletEvent.event(ctx, { type: 'purchase_need_action', body: { pid, uid, amount, product } });
        if (product.type === 'group') {
            await Modules.Messaging.premiumChat.onPurchaseNeedAction(ctx, pid, product.gid, uid, amount);
        }
    }

    onPurchaseCanceled = async (ctx: Context, pid: string, uid: number, amount: number, product: WalletPurchaseCreateShape['product']) => {
        await walletEvent.event(ctx, { type: 'purchase_canceled', body: { pid, uid, amount, product } });
        if (product.type === 'group') {
            await Modules.Messaging.premiumChat.onPurchaseCanceled(ctx, pid, product.gid, uid, amount);
        }
    }

    //
    // Subscription Events
    //

    /**
     * Subscription is started
     */
    onSubscriptionStarted = async (ctx: Context, id: string, txid: string) => {
        let subscription = await this.store.WalletSubscription.findById(ctx, id);
        if (subscription) {
            await walletEvent.event(ctx, { type: 'subscription_started', body: subscriptionToEvent(subscription) });
        }
        if (subscription && subscription.proudct.type === 'group') {
            await Modules.Messaging.premiumChat.onSubscriptionStarted(ctx, subscription.id, txid, subscription.proudct.gid, subscription.uid);
        }
    }

    /**
     * Payment failing, but subscription is still alive
     */
    onSubscriptionFailing = async (ctx: Context, id: string) => {
        let subscription = await this.store.WalletSubscription.findById(ctx, id);
        if (subscription) {
            await walletEvent.event(ctx, { type: 'subscription_failing', body: subscriptionToEvent(subscription) });
        }
        if (subscription && subscription.proudct.type === 'group') {
            await Modules.Messaging.premiumChat.onSubscriptionFailing(ctx, subscription.id, subscription.proudct.gid, subscription.uid);
        }
    }

    /**
     * Payment Period success
     */
    onSubscriptionPaymentSuccess = async (ctx: Context, id: string, txid: string, index: number) => {
        let subscription = await this.store.WalletSubscription.findById(ctx, id);
        if (subscription) {
            await walletEvent.event(ctx, {
                type: 'subscription_payment_success',
                body: subscriptionToEvent(subscription)
            });
        }
        if (subscription && subscription.proudct.type === 'group') {
            await Modules.Messaging.premiumChat.onSubscriptionPaymentSuccess(ctx, subscription.id, txid, subscription.proudct.gid, subscription.uid);
        }
    }

    /**
     * Recovered from failing state
     */
    onSubscriptionRecovered = async (ctx: Context, id: string) => {
        let subscription = await this.store.WalletSubscription.findById(ctx, id);
        if (subscription) {
            await walletEvent.event(ctx, { type: 'subscription_recovered', body: subscriptionToEvent(subscription) });
        }
        if (subscription && subscription.proudct.type === 'group') {
            await Modules.Messaging.premiumChat.onSubscriptionRecovered(ctx, subscription.id, subscription.proudct.gid, subscription.uid);
        }
    }

    /**
     * Grace Period expired - pause subscription
     */
    onSubscriptionPaused = async (ctx: Context, id: string) => {
        let subscription = await this.store.WalletSubscription.findById(ctx, id);
        if (subscription) {
            await walletEvent.event(ctx, { type: 'subscription_paused', body: subscriptionToEvent(subscription) });
        }

        if (subscription && subscription.proudct.type === 'group') {
            await Modules.Messaging.premiumChat.onSubscriptionPaused(ctx, subscription.id, subscription.proudct.gid, subscription.uid);
        }
    }

    /**
     * Subscription restarted
     */
    onSubscriptionRestarted = async (ctx: Context, id: string) => {
        let subscription = await this.store.WalletSubscription.findById(ctx, id);
        if (subscription) {
            await walletEvent.event(ctx, { type: 'subscription_restarted', body: subscriptionToEvent(subscription) });
        }
        if (subscription && subscription.proudct.type === 'group') {
            await Modules.Messaging.premiumChat.onSubscriptionRestarted(ctx, subscription.id, subscription.proudct.gid, subscription.uid);
        }
    }

    /**
     * Subscription ended
     */
    onSubscriptionExpired = async (ctx: Context, id: string) => {
        let subscription = await this.store.WalletSubscription.findById(ctx, id);
        if (subscription) {
            await walletEvent.event(ctx, { type: 'subscription_expired', body: subscriptionToEvent(subscription) });
        }

        if (subscription && subscription.proudct.type === 'group') {
            await Modules.Messaging.premiumChat.onSubscriptionExpired(ctx, subscription.id, subscription.proudct.gid, subscription.uid);
        }
    }

    /**
     * Subscription canceled, but not expired yet
     */
    onSubscriptionCanceled = async (ctx: Context, id: string) => {
        let subscription = await this.store.WalletSubscription.findById(ctx, id);
        if (subscription) {
            await walletEvent.event(ctx, { type: 'subscription_canceled', body: subscriptionToEvent(subscription) });
        }

        if (subscription && subscription.proudct.type === 'group') {
            await Modules.Messaging.premiumChat.onSubscriptionCanceled(ctx, subscription.id, subscription.proudct.gid, subscription.uid);
        }
    }

    //
    // Payment Intent Events
    //

    onPaymentIntentSuccess = async (ctx: Context, amount: number, operation: PaymentIntentCreateShape['operation']) => {
        await walletEvent.event(ctx, { type: 'payment_intent_success', body: { amount, operation } });
        if (operation.type === 'deposit') {
            await this.wallet.depositInstant(ctx, operation.uid, amount);
        } else if (operation.type === 'payment') {
            await this.payments.handlePaymentIntentSuccess(ctx, operation.id);
        } else if (operation.type === 'purchase') {
            // Obsolete
            // await this.purchases.onPurchaseSuccessful(ctx, operation.id);
        } else {
            throw Error('Unknown operation type');
        }
    }

    onPaymentIntentCanceled = async (ctx: Context, amount: number, operation: PaymentIntentCreateShape['operation']) => {
        await walletEvent.event(ctx, { type: 'payment_intent_canceled', body: { amount, operation } });
        if (operation.type === 'deposit') {
            // Nothing To Do
        } else if (operation.type === 'payment') {
            await this.payments.handlePaymentIntentCanceled(ctx, operation.id);
        } else if (operation.type === 'purchase') {
            // Obsolete
            // await this.purchases.onPurchaseCanceled(ctx, operation.id);
        } else {
            throw Error('Unknown operation type');
        }
    }

    onPaymentIntentNeedAction = async (ctx: Context, amount: number, operation: PaymentIntentCreateShape['operation']) => {
        await walletEvent.event(ctx, { type: 'payment_intent_need_action', body: { amount, operation } });
        if (operation.type === 'deposit') {
            // Nothing To Do
        } else if (operation.type === 'payment') {
            await this.payments.handlePaymentActionRequired(ctx, operation.id);
        } else if (operation.type === 'purchase') {
            // Obsolete
        } else {
            throw Error('Unknown operation type');
        }
    }

    onPaymentIntentFailing = async (ctx: Context, amount: number, operation: PaymentIntentCreateShape['operation']) => {
        await walletEvent.event(ctx, { type: 'payment_intent_failing', body: { amount, operation } });
        if (operation.type === 'deposit') {
            // Nothing To Do
        } else if (operation.type === 'payment') {
            await this.payments.handlePaymentFailing(ctx, operation.id);
        } else if (operation.type === 'purchase') {
            // Obsolete
        } else {
            throw Error('Unknown operation type');
        }
    }
}

export type RoutingRepository = Partial<RoutingRepositoryImpl>;
