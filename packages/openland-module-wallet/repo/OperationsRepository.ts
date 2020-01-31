import { WalletSubscriptionCreateShape } from '../../openland-module-db/store';
import { Store } from 'openland-module-db/store';
import { WalletRepository } from 'openland-module-wallet/repo/WalletRepository';
import { PaymentsRepository } from 'openland-module-wallet/repo/PaymentsRepository';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { uuid } from 'openland-utils/uuid';
import { SubscriptionsRepository } from './SubscriptionsRepository';
import { paymentAmounts } from './utils/paymentAmounts';

export class OperationsRepository {

    readonly store: Store;
    readonly wallet: WalletRepository;
    readonly payments: PaymentsRepository;
    readonly subscriptions: SubscriptionsRepository;

    constructor(store: Store, wallet: WalletRepository, payments: PaymentsRepository, subscriptions: SubscriptionsRepository) {
        this.store = store;
        this.payments = payments;
        this.wallet = wallet;
        this.subscriptions = subscriptions;
    }

    //
    // Deposit
    //

    createDepositPayment = async (parent: Context, uid: number, amount: number, retryKey: string) => {
        await inTx(parent, async (ctx) => {

            // Retry Handling
            let retry = await this.store.WalletDepositRequest.findById(ctx, uid, retryKey);
            if (retry) {
                return;
            }
            let pid = uuid();
            await this.store.WalletDepositRequest.create(ctx, uid, retryKey, { pid: pid });

            // Wallet Transaction
            let txid = await this.wallet.depositAsync(ctx, uid, amount, pid);

            // Payment
            await this.payments.createPayment(ctx, pid, uid, amount, {
                type: 'deposit',
                uid: uid,
                txid: txid
            });
        });
    }

    //
    // Transfer
    //

    createTransferPayment = async (parent: Context, fromUid: number, toUid: number, amount: number, retryKey: string) => {
        await inTx(parent, async (ctx) => {

            // Retry Handling
            let retry = await this.store.WalletTransferRequest.findById(ctx, fromUid, toUid, retryKey);
            if (retry) {
                return;
            }

            let walletBalance = (await this.wallet.getWallet(ctx, fromUid)).balance;

            let amounts = paymentAmounts(walletBalance, amount);

            if (amounts.charge === 0) {
                // Retry
                await this.store.WalletTransferRequest.create(ctx, fromUid, toUid, retryKey, { pid: null });
                // Wallet transfer
                await this.wallet.transferBalance(ctx, fromUid, toUid, amount);
            } else {
                // Retry
                let pid = uuid();
                await this.store.WalletTransferRequest.create(ctx, fromUid, toUid, retryKey, { pid: pid });

                // Transaction
                let { txOut, txIn } = await this.wallet.transferAsync(ctx, fromUid, toUid, amounts.wallet, amounts.charge, pid);

                // Payment
                await this.payments.createPayment(ctx, pid, fromUid, amount, {
                    type: 'transfer',
                    fromUid,
                    fromTx: txOut,
                    toUid,
                    toTx: txIn
                });
            }
        });
    }

    //
    // Subscriptions
    // 

    createSubscription = async (parent: Context, uid: number, amount: number, interval: 'week' | 'month', product: WalletSubscriptionCreateShape['proudct']) => {
        return await this.subscriptions.createSubscription(parent, uid, amount, interval, product, Date.now());
    }
}