import { uuid } from 'openland-utils/uuid';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { Store, WalletBalanceChanged, WalletTransactionPending, WalletTransactionSuccess, PaymentStatusChanged, WalletTransactionCanceled } from './../../openland-module-db/store';
import { checkMoney } from './utils/checkMoney';

export class WalletRepository {
    readonly store: Store;

    constructor(store: Store) {
        this.store = store;
    }

    getWallet = async (parent: Context, uid: number) => {
        return await inTx(parent, async (ctx) => {
            let res = await this.store.Wallet.findById(ctx, uid);
            if (!res) {
                res = await this.store.Wallet.create(ctx, uid, { balance: 0 });
            }
            return res;
        });
    }

    //
    // Deposits
    //

    depositInstant = async (parent: Context, uid: number, amount: number) => {
        checkMoney(amount);

        await inTx(parent, async (ctx) => {

            // Update Wallet
            let wallet = await this.getWallet(ctx, uid);
            wallet.balance += amount;

            // Create Transaction
            let txid = uuid();
            await this.store.WalletTransaction.create(ctx, txid, {
                uid: uid,
                status: 'success',
                operation: {
                    type: 'deposit',
                    amount: amount,
                    payment: null
                }
            });

            // Write events
            this.store.UserWalletUpdates.post(ctx, uid, WalletTransactionSuccess.create({ id: txid }));
            this.store.UserWalletUpdates.post(ctx, uid, WalletBalanceChanged.create({ amount: wallet.balance }));
        });
    }

    depositAsync = async (parent: Context, uid: number, amount: number, pid: string) => {
        checkMoney(amount);

        return await inTx(parent, async (ctx) => {

            // Create Transaction
            let txid = uuid();
            await this.store.WalletTransaction.create(ctx, txid, {
                uid: uid,
                status: 'pending',
                operation: {
                    type: 'deposit',
                    amount: amount,
                    payment: pid
                }
            });

            // Write events           
            this.store.UserWalletUpdates.post(ctx, uid, WalletTransactionPending.create({ id: txid }));

            return txid;
        });
    }

    depositAsyncCommit = async (parent: Context, uid: number, txid: string) => {
        await inTx(parent, async (ctx) => {

            // Check state
            let tx = await this.store.WalletTransaction.findById(ctx, txid);
            if (!tx) {
                throw Error('Unable to find transaction');
            }
            if (tx.status === 'success' || tx.status === 'canceled') {
                throw Error('Transaction is in completed state');
            }
            if (tx.operation.type !== 'deposit') {
                throw Error('Transaction has invalid operation type');
            }
            if (tx.uid !== uid) {
                throw Error('Transaction has invalid user id');
            }
            if (!tx.operation.payment) {
                throw Error('Transaction doesnt have payment reference');
            }

            // Update tx status
            tx.status = 'success';

            // Update Wallet
            let wallet = await this.getWallet(ctx, uid);
            wallet.balance += tx.operation.amount;

            // Write events
            this.store.UserWalletUpdates.post(ctx, uid, WalletTransactionSuccess.create({ id: txid }));
            this.store.UserWalletUpdates.post(ctx, uid, WalletBalanceChanged.create({ amount: wallet.balance }));
        });
    }

    depositAsyncCancel = async (parent: Context, uid: number, txid: string) => {
        await inTx(parent, async (ctx) => {

            // Check state
            let tx = await this.store.WalletTransaction.findById(ctx, txid);
            if (!tx) {
                throw Error('Unable to find transaction');
            }
            if (tx.status === 'success' || tx.status === 'canceled') {
                throw Error('Transaction is in completed state');
            }
            if (tx.operation.type !== 'deposit') {
                throw Error('Transaction has invalid operation type');
            }
            if (tx.uid !== uid) {
                throw Error('Transaction has invalid user id');
            }
            if (!tx.operation.payment) {
                throw Error('Transaction doesnt have payment reference');
            }

            // Update tx status
            tx.status = 'canceled';

            // Write events
            this.store.UserWalletUpdates.post(ctx, uid, WalletTransactionCanceled.create({ id: txid }));
        });
    }

    depositAsyncFailing = async (parent: Context, uid: number, txid: string) => {
        await inTx(parent, async (ctx) => {

            // Check state
            let tx = await this.store.WalletTransaction.findById(ctx, txid);
            if (!tx) {
                throw Error('Unable to find transaction');
            }
            if (tx.status === 'success' || tx.status === 'canceled') {
                throw Error('Transaction is in completed state');
            }
            if (tx.operation.type !== 'deposit') {
                throw Error('Transaction has invalid operation type');
            }
            if (tx.uid !== uid) {
                throw Error('Transaction has invalid user id');
            }
            if (!tx.operation.payment) {
                throw Error('Transaction doesnt have payment reference');
            }

            // Write event
            this.store.UserWalletUpdates.post(ctx, uid, PaymentStatusChanged.create({ id: tx.operation.payment! }));
        });
    }
    depositAsyncActionNeeded = async (parent: Context, uid: number, txid: string) => {
        await inTx(parent, async (ctx) => {

            // Check state
            let tx = await this.store.WalletTransaction.findById(ctx, txid);
            if (!tx) {
                throw Error('Unable to find transaction');
            }
            if (tx.status === 'success' || tx.status === 'canceled') {
                throw Error('Transaction is in completed state');
            }
            if (tx.operation.type !== 'deposit') {
                throw Error('Transaction has invalid operation type');
            }
            if (tx.uid !== uid) {
                throw Error('Transaction has invalid user id');
            }
            if (!tx.operation.payment) {
                throw Error('Transaction doesnt have payment reference');
            }

            // Write event
            this.store.UserWalletUpdates.post(ctx, uid, PaymentStatusChanged.create({ id: tx.operation.payment! }));
        });
    }

    //
    // Subscriptions
    //

    subscriptionPayment = async (parent: Context, uid: number, amount: number, sid: string, index: number) => {
        checkMoney(amount);

        return await inTx(parent, async (ctx) => {

            // Create Transaction
            let txid = uuid();
            await this.store.WalletTransaction.create(ctx, txid, {
                uid: uid,
                status: 'pending',
                operation: {
                    type: 'subscription',
                    chargeAmount: amount,
                    walletAmount: 0,
                    subscription: sid,
                    index: index
                }
            });

            // Write events           
            this.store.UserWalletUpdates.post(ctx, uid, WalletTransactionPending.create({ id: txid }));

            return txid;
        });
    }

    subscriptionPaymentCommit = async (parent: Context, uid: number, txid: string) => {
        await inTx(parent, async (ctx) => {

            // Check state
            let tx = await this.store.WalletTransaction.findById(ctx, txid);
            if (!tx) {
                throw Error('Unable to find transaction');
            }
            if (tx.status === 'success' || tx.status === 'canceled') {
                throw Error('Transaction is in completed state');
            }
            if (tx.operation.type !== 'subscription') {
                throw Error('Transaction has invalid operation type');
            }
            if (tx.uid !== uid) {
                throw Error('Transaction has invalid user id');
            }

            // Update tx status
            tx.status = 'success';

            // Write events
            this.store.UserWalletUpdates.post(ctx, uid, WalletTransactionSuccess.create({ id: txid }));
        });
    }

    subscriptionPaymentFailing = async (parent: Context, uid: number, txid: string) => {
        await inTx(parent, async (ctx) => {

            // Check state
            let tx = await this.store.WalletTransaction.findById(ctx, txid);
            if (!tx) {
                throw Error('Unable to find transaction');
            }
            if (tx.status === 'success' || tx.status === 'canceled') {
                throw Error('Transaction is in completed state');
            }
            if (tx.operation.type !== 'subscription') {
                throw Error('Transaction has invalid operation type');
            }
            if (tx.uid !== uid) {
                throw Error('Transaction has invalid user id');
            }

            let period = (await this.store.WalletSubscriptionPeriod.findById(ctx, tx.operation.subscription, tx.operation.index))!;

            // Write event
            this.store.UserWalletUpdates.post(ctx, uid, PaymentStatusChanged.create({ id: period!.pid }));
        });
    }

    subscriptionPaymentActionNeeded = async (parent: Context, uid: number, txid: string) => {
        await inTx(parent, async (ctx) => {

            // Check state
            let tx = await this.store.WalletTransaction.findById(ctx, txid);
            if (!tx) {
                throw Error('Unable to find transaction');
            }
            if (tx.status === 'success' || tx.status === 'canceled') {
                throw Error('Transaction is in completed state');
            }
            if (tx.operation.type !== 'subscription') {
                throw Error('Transaction has invalid operation type');
            }
            if (tx.uid !== uid) {
                throw Error('Transaction has invalid user id');
            }

            let period = (await this.store.WalletSubscriptionPeriod.findById(ctx, tx.operation.subscription, tx.operation.index))!;

            // Write event
            this.store.UserWalletUpdates.post(ctx, uid, PaymentStatusChanged.create({ id: period!.pid }));
        });
    }

    subscriptionPaymentCancel = async (parent: Context, uid: number, txid: string) => {
        await inTx(parent, async (ctx) => {

            // Check state
            let tx = await this.store.WalletTransaction.findById(ctx, txid);
            if (!tx) {
                throw Error('Unable to find transaction');
            }
            if (tx.status === 'success' || tx.status === 'canceled') {
                throw Error('Transaction is in completed state');
            }
            if (tx.operation.type !== 'subscription') {
                throw Error('Transaction has invalid operation type');
            }
            if (tx.uid !== uid) {
                throw Error('Transaction has invalid user id');
            }

            // Update tx status
            tx.status = 'canceled';

            // Write events
            this.store.UserWalletUpdates.post(ctx, uid, WalletTransactionCanceled.create({ id: txid }));
        });
    }

    //
    // Transfers
    //

    transferBalance = async (parent: Context, fromUid: number, toUid: number, amount: number) => {
        checkMoney(amount);

        await inTx(parent, async (ctx) => {

            // Update Wallet
            let fromWallet = await this.getWallet(ctx, fromUid);
            let wallet = await this.getWallet(ctx, toUid);
            if (fromWallet.balance < amount) {
                throw new Error('Insufficient funds');
            }
            fromWallet.balance -= amount;
            wallet.balance += amount;

            // Create Transaction
            let senderTxid = uuid();
            let receiverTxid = uuid();
            await this.store.WalletTransaction.create(ctx, senderTxid, {
                uid: fromUid,
                status: 'success',
                operation: {
                    type: 'transfer_out',
                    toUser: toUid,
                    walletAmount: amount,
                    chargeAmount: 0,
                    payment: { type: 'balance' }
                }
            });
            await this.store.WalletTransaction.create(ctx, receiverTxid, {
                uid: toUid,
                status: 'success',
                operation: {
                    type: 'transfer_in',
                    fromUser: fromUid,
                    amount
                }
            });

            // Write events
            this.store.UserWalletUpdates.post(ctx, fromUid, WalletTransactionSuccess.create({ id: senderTxid }));
            this.store.UserWalletUpdates.post(ctx, fromUid, WalletBalanceChanged.create({ amount: fromWallet.balance }));

            this.store.UserWalletUpdates.post(ctx, toUid, WalletTransactionSuccess.create({ id: receiverTxid }));
            this.store.UserWalletUpdates.post(ctx, toUid, WalletBalanceChanged.create({ amount: wallet.balance }));
        });
    }

    transferAsync = async (parent: Context, fromUid: number, toUid: number, walletAmount: number, chargeAmount: number, pid: string) => {
        if (walletAmount !== 0) {
            checkMoney(walletAmount);
        }
        if (chargeAmount !== 0) {
            checkMoney(chargeAmount);
        }
        checkMoney(walletAmount + chargeAmount);

        return await inTx(parent, async (ctx) => {

            // Wallet balance lock
            let fromWallet = await this.getWallet(ctx, fromUid);
            if (walletAmount > 0) {
                if (fromWallet.balance < walletAmount) {
                    throw new Error('Insufficient funds');
                }
                fromWallet.balance -= walletAmount;
            }

            // Create Transaction
            let txOut = uuid();
            let txIn = uuid();
            await this.store.WalletTransaction.create(ctx, txOut, {
                uid: fromUid,
                status: 'pending',
                operation: {
                    type: 'transfer_out',
                    walletAmount: walletAmount,
                    chargeAmount: chargeAmount,
                    toUser: toUid,
                    payment: { type: 'payment', id: pid }
                }
            });
            await this.store.WalletTransaction.create(ctx, txIn, {
                uid: toUid,
                status: 'pending',
                operation: {
                    type: 'transfer_in',
                    amount: (walletAmount + chargeAmount),
                    fromUser: fromUid
                }
            });

            // Write events
            if (walletAmount > 0) {
                this.store.UserWalletUpdates.post(ctx, fromUid, WalletBalanceChanged.create({ amount: fromWallet.balance }));
            }
            this.store.UserWalletUpdates.post(ctx, fromUid, WalletTransactionPending.create({ id: txOut }));
            this.store.UserWalletUpdates.post(ctx, toUid, WalletTransactionPending.create({ id: txIn }));

            return { txOut, txIn };
        });
    }

    transferAsyncCommit = async (parent: Context, fromUid: number, fromTxId: string, toUid: number, toTxId: string) => {
        await inTx(parent, async (ctx) => {

            // Check state
            let fromTx = await this.store.WalletTransaction.findById(ctx, fromTxId);
            let toTx = await this.store.WalletTransaction.findById(ctx, toTxId);
            if (!fromTx) {
                throw Error('Unable to find transaction');
            }
            if (!toTx) {
                throw Error('Unable to find transaction');
            }
            if (fromTx.status === 'success' || fromTx.status === 'canceled' || toTx.status === 'success' || toTx.status === 'canceled') {
                throw Error('Transaction is in completed state');
            }
            if (fromTx.operation.type !== 'transfer_out') {
                throw Error('Transaction has invalid operation type: ' + fromTx.operation.type);
            }
            if (toTx.operation.type !== 'transfer_in') {
                throw Error('Transaction has invalid operation type: ' + toTx.operation.type);
            }
            if (fromTx.uid !== fromUid) {
                throw Error('Transaction has invalid user id');
            }
            if (toTx.uid !== toUid) {
                throw Error('Transaction has invalid user id');
            }
            if (fromTx.operation.payment.type !== 'payment') {
                throw Error('Transaction doesnt have payment reference');
            }

            // Update tx status
            fromTx.status = 'success';
            toTx.status = 'success';

            // Update Wallet
            let wallet = await this.getWallet(ctx, toTx.uid);
            wallet.balance += toTx.operation.amount;

            // Write events
            this.store.UserWalletUpdates.post(ctx, fromUid, WalletTransactionSuccess.create({ id: fromTxId }));
            this.store.UserWalletUpdates.post(ctx, toUid, WalletTransactionSuccess.create({ id: toTxId }));
            this.store.UserWalletUpdates.post(ctx, toUid, WalletBalanceChanged.create({ amount: wallet.balance }));
        });
    }

    transferAsyncFailing = async (parent: Context, fromUid: number, fromTxId: string, toUid: number, toTxId: string, pid: string) => {
        await inTx(parent, async (ctx) => {

            // Check state
            let fromTx = await this.store.WalletTransaction.findById(ctx, fromTxId);
            let toTx = await this.store.WalletTransaction.findById(ctx, toTxId);
            if (!fromTx) {
                throw Error('Unable to find transaction');
            }
            if (!toTx) {
                throw Error('Unable to find transaction');
            }
            if (fromTx.status === 'success' || fromTx.status === 'canceled' || toTx.status === 'success' || toTx.status === 'canceled') {
                throw Error('Transaction is in completed state');
            }
            if (fromTx.operation.type !== 'transfer_out') {
                throw Error('Transaction has invalid operation type');
            }
            if (toTx.operation.type !== 'transfer_in') {
                throw Error('Transaction has invalid operation type');
            }
            if (fromTx.uid !== fromUid) {
                throw Error('Transaction has invalid user id');
            }
            if (toTx.uid !== toUid) {
                throw Error('Transaction has invalid user id');
            }
            if (fromTx.operation.payment.type !== 'payment') {
                throw Error('Transaction doesnt have payment reference');
            }

            // Write event
            this.store.UserWalletUpdates.post(ctx, fromUid, PaymentStatusChanged.create({ id: pid }));
        });
    }
    transferAsyncActionNeeded = async (parent: Context, fromUid: number, fromTxId: string, toUid: number, toTxId: string, pid: string) => {
        await inTx(parent, async (ctx) => {

            // Check state
            let fromTx = await this.store.WalletTransaction.findById(ctx, fromTxId);
            let toTx = await this.store.WalletTransaction.findById(ctx, toTxId);
            if (!fromTx) {
                throw Error('Unable to find transaction');
            }
            if (!toTx) {
                throw Error('Unable to find transaction');
            }
            if (fromTx.status === 'success' || fromTx.status === 'canceled' || toTx.status === 'success' || toTx.status === 'canceled') {
                throw Error('Transaction is in completed state');
            }
            if (fromTx.operation.type !== 'transfer_out') {
                throw Error('Transaction has invalid operation type');
            }
            if (toTx.operation.type !== 'transfer_in') {
                throw Error('Transaction has invalid operation type');
            }
            if (fromTx.uid !== fromUid) {
                throw Error('Transaction has invalid user id');
            }
            if (toTx.uid !== toUid) {
                throw Error('Transaction has invalid user id');
            }
            if (fromTx.operation.payment.type !== 'payment') {
                throw Error('Transaction doesnt have payment reference');
            }

            // Write event
            this.store.UserWalletUpdates.post(ctx, fromUid, PaymentStatusChanged.create({ id: pid }));
        });
    }

    transferAsyncCancel = async (parent: Context, fromUid: number, fromTxId: string, toUid: number, toTxId: string) => {
        await inTx(parent, async (ctx) => {

            // Check state
            let fromTx = await this.store.WalletTransaction.findById(ctx, fromTxId);
            let toTx = await this.store.WalletTransaction.findById(ctx, toTxId);
            if (!fromTx) {
                throw Error('Unable to find transaction');
            }
            if (!toTx) {
                throw Error('Unable to find transaction');
            }
            if (fromTx.status === 'success' || fromTx.status === 'canceled' || toTx.status === 'success' || toTx.status === 'canceled') {
                throw Error('Transaction is in completed state');
            }
            if (fromTx.operation.type !== 'transfer_out') {
                throw Error('Transaction has invalid operation type');
            }
            if (toTx.operation.type !== 'transfer_in') {
                throw Error('Transaction has invalid operation type');
            }
            if (fromTx.uid !== fromUid) {
                throw Error('Transaction has invalid user id');
            }
            if (toTx.uid !== toUid) {
                throw Error('Transaction has invalid user id');
            }
            if (fromTx.operation.payment.type !== 'payment') {
                throw Error('Transaction doesnt have payment reference');
            }

            // Update tx status
            fromTx.status = 'canceled';
            toTx.status = 'canceled';

            // Restore wallet amount
            let fromWallet = await this.getWallet(ctx, fromUid);
            if (fromTx.operation.walletAmount > 0) {
                fromWallet.balance += fromTx.operation.walletAmount;
            }

            // Write events
            this.store.UserWalletUpdates.post(ctx, fromUid, WalletTransactionCanceled.create({ id: fromTxId }));
            this.store.UserWalletUpdates.post(ctx, toUid, WalletTransactionCanceled.create({ id: toTxId }));
            if (fromTx.operation.walletAmount > 0) {
                this.store.UserWalletUpdates.post(ctx, fromUid, WalletBalanceChanged.create({ amount: fromWallet.balance }));
            }
        });
    }
}