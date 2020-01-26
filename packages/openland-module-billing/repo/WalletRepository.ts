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
}