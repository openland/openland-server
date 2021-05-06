import { uuid } from 'openland-utils/uuid';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { Store, WalletBalanceChanged, WalletTransactionPending, WalletTransactionSuccess, PaymentStatusChanged, WalletTransactionCanceled, WalletLockedChanged } from '../../openland-module-db/store';
import { checkMoney } from './utils/checkMoney';
import { Modules } from 'openland-modules/Modules';
import { Emails } from 'openland-module-email/Emails';

export class WalletRepository {
    readonly store: Store;

    constructor(store: Store) {
        this.store = store;
    }

    getWallet = async (parent: Context, uid: number) => {
        return await inTx(parent, async (ctx) => {
            let res = await this.store.Wallet.findById(ctx, uid);
            if (!res) {
                res = await this.store.Wallet.create(ctx, uid, { balance: 0, balanceLocked: 0 });
            }
            return res;
        });
    }

    isLocked = async (parent: Context, uid: number) => {
        return !!(await this.getWallet(parent, uid)).isLocked;
    }

    getFailingPaymentsCount = async (parent: Context, uid: number) => {
        return (await this.store.Payment.userFailing.findAll(parent, uid)).length;
    }

    updateIsLocked = async (parent: Context, uid: number) => {
        return await inTx(parent, async (ctx) => {
            let wallet = await this.getWallet(parent, uid);
            let oldState = !!wallet.isLocked;
            let failingPaymentsCount = await this.getFailingPaymentsCount(parent, uid);
            let isLocked = failingPaymentsCount > 0;
            wallet.isLocked = isLocked;
            await wallet.flush(ctx);
            this.store.UserWalletUpdates.post(ctx, uid, WalletLockedChanged.create({ isLocked, failingPaymentsCount }));
            if (oldState !== isLocked) {
                if (isLocked) {
                    Modules.Push.pushWork(ctx, {
                        uid: uid,
                        counter: null,
                        conversationId: null,
                        deepLink: 'wallet',
                        mobile: true,
                        desktop: true,
                        picture: null,
                        silent: false,
                        title: 'Transaction failed',
                        body: 'A payment for some of your recent purchases or subscriptions has recently failed. Please update your payment method to keep your paid group memberships.',
                        mobileAlert: true,
                        mobileIncludeText: true,
                        messageId: null,
                        commentId: null
                    });

                    await Emails.sendGenericEmail(ctx, uid, {
                        subject: 'Transaction failed',
                        title: 'Transaction failed',
                        text: 'A payment for some of your recent purchases or subscriptions has recently failed. Please update your payment method to keep your paid group memberships.',
                        link: 'https://openland.com/wallet',
                        buttonText: 'Update payment method'
                    });
                } else {
                    Modules.Push.sendCounterPush(ctx, uid);
                }

            }
        });
    }

    getAvailableBalance = async (parent: Context, uid: number) => {
        return await inTx(parent, async (ctx) => {
            let res = await this.store.Wallet.findById(ctx, uid);
            if (!res) {
                res = await this.store.Wallet.create(ctx, uid, { balance: 0, balanceLocked: 0 });
            }
            return res.balance - res.balanceLocked;
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
    // Income
    //

    incomePending = async (parent: Context, parentTxid: string, uid: number, amount: number, source: { type: 'purchase', id: string } | { type: 'subscription', id: string }) => {
        await inTx(parent, async (ctx) => {
            let incomeTxid = uuid();
            let tx = await this.store.WalletTransaction.create(ctx, incomeTxid, {
                uid: uid,
                status: 'pending',
                parentId: parentTxid,
                operation: {
                    type: 'income',
                    amount: amount,
                    source: source.type,
                    id: source.id
                }
            });
            await tx.flush(ctx);

            // Write events
            this.store.UserWalletUpdates.post(ctx, uid, WalletTransactionPending.create({ id: incomeTxid }));
        });
    }

    incomeSuccess = async (parent: Context, parentTxid: string, uid: number, amount: number, source: { type: 'purchase', id: string } | { type: 'subscription', id: string }) => {
        await inTx(parent, async (ctx) => {
            let transactions = await this.store.WalletTransaction.pendingChild.findAll(ctx, parentTxid);

            if (transactions.length <= 0) {
                let wallet = await this.getWallet(ctx, uid);
                wallet.balance += amount;

                let incomeTxid = uuid();
                await this.store.WalletTransaction.create(ctx, incomeTxid, {
                    uid: uid,
                    status: 'success',
                    parentId: parentTxid,
                    operation: {
                        type: 'income',
                        amount: amount,
                        source: source.type,
                        id: source.id
                    }
                });

                this.store.UserWalletUpdates.post(ctx, uid, WalletTransactionSuccess.create({ id: incomeTxid }));
                this.store.UserWalletUpdates.post(ctx, uid, WalletBalanceChanged.create({ amount: wallet.balance }));
            } else {
                transactions.forEach(async (transaction) => {
                    if (transaction.operation.type === 'income') {
                        let wallet = await this.getWallet(ctx, transaction.uid);
                        wallet.balance += transaction.operation.amount;

                        transaction.status = 'success';

                        // Write events
                        this.store.UserWalletUpdates.post(ctx, transaction.uid, WalletTransactionSuccess.create({ id: transaction.id }));
                        this.store.UserWalletUpdates.post(ctx, transaction.uid, WalletBalanceChanged.create({ amount: wallet.balance }));
                    }
                });
            }
        });
    }

    //
    // Purchases
    //

    purchaseCreatedInstant = async (parent: Context, id: string, uid: number, walletAmount: number) => {
        checkMoney(walletAmount);
        return await inTx(parent, async (ctx) => {
            let wallet = await this.getWallet(ctx, uid);
            if (walletAmount > 0) {
                if (wallet.balance - wallet.balanceLocked < walletAmount) {
                    throw Error('Invalid walelt amount');
                }
                wallet.balance -= walletAmount;
            }

            // Create Transaction
            let txid = uuid();
            await this.store.WalletTransaction.create(ctx, txid, {
                uid: uid,
                status: 'success',
                operation: {
                    type: 'purchase',
                    chargeAmount: 0,
                    walletAmount,
                    purchase: id,
                    payment: { type: 'balance' }
                }
            });

            // Write events           
            this.store.UserWalletUpdates.post(ctx, uid, WalletTransactionSuccess.create({ id: txid }));
            this.store.UserWalletUpdates.post(ctx, uid, WalletBalanceChanged.create({ amount: wallet.balance }));
            return txid;
        });
    }

    purchaseCreated = async (parent: Context, id: string, pid: string, uid: number, walletAmount: number, chargeAmount: number) => {
        if (walletAmount !== 0) {
            checkMoney(walletAmount);
        }
        checkMoney(chargeAmount);
        checkMoney(walletAmount + chargeAmount);

        return await inTx(parent, async (ctx) => {
            let wallet = await this.getWallet(ctx, uid);
            if (walletAmount > 0) {
                if (wallet.balance - wallet.balanceLocked < walletAmount) {
                    throw Error('Invalid walelt amount');
                }
                wallet.balance -= walletAmount;
            }

            // Create Transaction
            let txid = uuid();
            await this.store.WalletTransaction.create(ctx, txid, {
                uid: uid,
                status: 'pending',
                operation: {
                    type: 'purchase',
                    chargeAmount,
                    walletAmount,
                    purchase: id,
                    payment: {
                        type: 'payment',
                        id: pid
                    }
                }
            });

            // Write events           
            this.store.UserWalletUpdates.post(ctx, uid, WalletTransactionPending.create({ id: txid }));
            this.store.UserWalletUpdates.post(ctx, uid, WalletBalanceChanged.create({ amount: wallet.balance }));
            return txid;
        });
    }

    purchaseSuccessful = async (parent: Context, uid: number, txid: string) => {
        return await inTx(parent, async (ctx) => {

            let tx = (await this.store.WalletTransaction.findById(ctx, txid))!;
            if (!tx) {
                throw Error('Unable to find transaction');
            }
            if (tx.status === 'success' || tx.status === 'canceled') {
                throw Error('Transaction is in completed state');
            }
            if (tx.operation.type !== 'purchase') {
                throw Error('Transaction has invalid operation type');
            }
            if (tx.uid !== uid) {
                throw Error('UID mismatch');
            }

            tx.status = 'success';

            this.store.UserWalletUpdates.post(ctx, uid, WalletTransactionSuccess.create({ id: txid }));
        });
    }

    purchaseFailing = async (parent: Context, uid: number, txid: string) => {
        return await inTx(parent, async (ctx) => {

            let tx = (await this.store.WalletTransaction.findById(ctx, txid))!;
            if (!tx) {
                throw Error('Unable to find transaction');
            }
            if (tx.status === 'success' || tx.status === 'canceled') {
                throw Error('Transaction is in completed state');
            }
            if (tx.operation.type !== 'purchase') {
                throw Error('Transaction has invalid operation type');
            }
            if (tx.operation.payment.type !== 'payment') {
                throw Error('Transaction has invalid payment reference');
            }
            if (tx.uid !== uid) {
                throw Error('UID mismatch');
            }

            // Write event
            this.store.UserWalletUpdates.post(ctx, uid, PaymentStatusChanged.create({ id: tx.operation.payment.id }));
        });
    }

    purchaseActionNeeded = async (parent: Context, uid: number, txid: string) => {
        return await inTx(parent, async (ctx) => {

            let tx = (await this.store.WalletTransaction.findById(ctx, txid))!;
            if (!tx) {
                throw Error('Unable to find transaction');
            }
            if (tx.status === 'success' || tx.status === 'canceled') {
                throw Error('Transaction is in completed state');
            }
            if (tx.operation.type !== 'purchase') {
                throw Error('Transaction has invalid operation type');
            }
            if (tx.operation.payment.type !== 'payment') {
                throw Error('Transaction has invalid payment reference');
            }
            if (tx.uid !== uid) {
                throw Error('UID mismatch');
            }

            // Write event
            this.store.UserWalletUpdates.post(ctx, uid, PaymentStatusChanged.create({ id: tx.operation.payment.id }));
        });
    }

    purchaseCanceled = async (parent: Context, uid: number, txid: string) => {
        return await inTx(parent, async (ctx) => {

            let tx = (await this.store.WalletTransaction.findById(ctx, txid))!;
            if (!tx) {
                throw Error('Unable to find transaction');
            }
            if (tx.status === 'success' || tx.status === 'canceled') {
                throw Error('Transaction is in completed state');
            }
            if (tx.operation.type !== 'purchase') {
                throw Error('Transaction has invalid operation type');
            }
            if (tx.uid !== uid) {
                throw Error('UID mismatch');
            }

            tx.status = 'canceled';

            // Reverce balance
            if (tx.operation.walletAmount > 0) {
                let wallet = await this.getWallet(ctx, uid);
                wallet.balance += tx.operation.walletAmount;
                this.store.UserWalletUpdates.post(ctx, uid, WalletBalanceChanged.create({ amount: wallet.balance }));
            }
        });
    }

    //
    // Subscriptions
    //

    subscriptionBalance = async (parent: Context, uid: number, amount: number, sid: string, index: number) => {
        checkMoney(amount);
        return await inTx(parent, async (ctx) => {
            let fromWallet = await this.getWallet(ctx, uid);
            if ((fromWallet.balance - fromWallet.balanceLocked) < amount) {
                throw new Error('Insufficient funds');
            }
            fromWallet.balance -= amount;

            // Create Transaction
            let txid = uuid();
            await this.store.WalletTransaction.create(ctx, txid, {
                uid: uid,
                status: 'success',
                operation: {
                    type: 'subscription',
                    chargeAmount: 0,
                    walletAmount: amount,
                    subscription: sid,
                    index: index
                }
            });

            // Write events           
            this.store.UserWalletUpdates.post(ctx, uid, WalletTransactionSuccess.create({ id: txid }));
            this.store.UserWalletUpdates.post(ctx, uid, WalletBalanceChanged.create({ amount: fromWallet.balance }));

            return txid;
        });
    }

    subscriptionPayment = async (parent: Context, uid: number, walletAmount: number, chargeAmount: number, sid: string, index: number) => {
        if (walletAmount !== 0) {
            checkMoney(walletAmount);
        }
        checkMoney(chargeAmount);
        checkMoney(walletAmount + chargeAmount);

        return await inTx(parent, async (ctx) => {

            // Wallet Update
            let fromWallet = await this.getWallet(ctx, uid);
            if (walletAmount > 0) {
                if ((fromWallet.balance - fromWallet.balanceLocked) < walletAmount) {
                    throw new Error('Insufficient funds');
                }
                fromWallet.balance -= walletAmount;
            }

            // Create Transaction
            let txid = uuid();
            await this.store.WalletTransaction.create(ctx, txid, {
                uid: uid,
                status: 'pending',
                operation: {
                    type: 'subscription',
                    chargeAmount: chargeAmount,
                    walletAmount: walletAmount,
                    subscription: sid,
                    index: index
                }
            });

            // Write events           
            this.store.UserWalletUpdates.post(ctx, uid, WalletTransactionPending.create({ id: txid }));
            this.store.UserWalletUpdates.post(ctx, uid, WalletBalanceChanged.create({ amount: fromWallet.balance }));

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

    subscriptionPaymentFailing = async (parent: Context, uid: number, txid: string, pid: string) => {
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

            // Write event
            this.store.UserWalletUpdates.post(ctx, uid, PaymentStatusChanged.create({ id: pid }));
        });
    }

    subscriptionPaymentActionNeeded = async (parent: Context, uid: number, txid: string, pid: string) => {
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

            // Write event
            this.store.UserWalletUpdates.post(ctx, uid, PaymentStatusChanged.create({ id: pid }));
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

            let fromWallet = await this.getWallet(ctx, tx.uid);
            if (tx.operation.walletAmount > 0) {
                fromWallet.balance += tx.operation.walletAmount;
            }

            // Write events
            this.store.UserWalletUpdates.post(ctx, uid, WalletTransactionCanceled.create({ id: txid }));
            if (tx.operation.walletAmount > 0) {
                this.store.UserWalletUpdates.post(ctx, uid, WalletBalanceChanged.create({ amount: fromWallet.balance }));
            }
        });
    }

    //
    // Transfers
    //

    transferBalance = async (parent: Context, fromUid: number, toUid: number, amount: number) => {
        checkMoney(amount);

        if (fromUid === toUid) {
            throw Error('Unable to transfer to yourself');
        }

        await inTx(parent, async (ctx) => {

            // Update Wallet
            let fromWallet = await this.getWallet(ctx, fromUid);
            let wallet = await this.getWallet(ctx, toUid);
            if ((fromWallet.balance - fromWallet.balanceLocked) < amount) {
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
        checkMoney(chargeAmount);
        checkMoney(walletAmount + chargeAmount);
        if (fromUid === toUid) {
            throw Error('Unable to transfer to yourself');
        }

        return await inTx(parent, async (ctx) => {

            // Wallet balance lock
            let fromWallet = await this.getWallet(ctx, fromUid);
            if (walletAmount > 0) {
                if ((fromWallet.balance - fromWallet.balanceLocked) < walletAmount) {
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