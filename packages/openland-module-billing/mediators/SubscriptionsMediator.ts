import { WalletSubscriptionCreateShape } from './../../openland-module-db/store';
import { Context } from '@openland/context';
import { SubscriptionsRepository } from './../repo/SubscriptionsRepository';
import { PaymentMediator } from './PaymentMediator';

export class SubscriptionsMediator {

    readonly payments: PaymentMediator;
    readonly subscriptions: SubscriptionsRepository;

    constructor(payments: PaymentMediator, subscriptions: SubscriptionsRepository) {
        this.payments = payments;
        this.subscriptions = subscriptions;
    }

    createSubscription = async (parent: Context, uid: number, amount: number, interval: 'week' | 'month', product: WalletSubscriptionCreateShape['proudct']) => {
        return await this.subscriptions.createSubscription(parent, uid, amount, interval, product);
    }
}