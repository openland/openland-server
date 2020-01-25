import { uuid } from 'openland-utils/uuid';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { Store, Account } from './../../openland-module-db/store';

export class BillingRepository {

    private readonly store: Store;

    constructor(store: Store) {
        this.store = store;
    }

    getUserAccount = async (parent: Context, uid: number) => {
        return await inTx(parent, async (ctx) => {
            let userAccount = await this.store.UserAccount.findById(ctx, uid);
            if (!userAccount) {
                let account = await this.store.Account.create(ctx, uuid(), { balance: 0 });
                await this.store.UserAccount.create(ctx, uid, { aid: account.id });
                return account;
            } else {
                let res = await this.store.Account.findById(ctx, userAccount.aid);
                if (!res) {
                    throw Error('Internal error');
                }
                return res;
            }
        });
    }

    createTransaction = async (parent: Context,
        fromUid: number | null,
        toUid: number | null,
        kind: 'deposit' | 'withdraw' | 'transfer' | 'purchase',
        amount: number
    ) => {

        // Arguments check
        if (amount < 0 || (amount === 0 && kind !== 'purchase')) {
            throw Error('Amount must be greater than zero');
        }
        if (kind === 'deposit') {
            if (fromUid !== null) {
                throw Error('Deposits can\'t have from uid');
            }
            if (toUid === null) {
                throw Error('Deposits require to uid');
            }
        } else if (kind === 'withdraw') {
            if (fromUid === null) {
                throw Error('Withdraw require from uid');
            }
            if (toUid !== null) {
                throw Error('Withdraw can\'t have to uid');
            }
        } else if (kind === 'transfer' || kind === 'purchase') {
            if (fromUid === null) {
                throw Error('Transfers require from uid');
            }
            if (toUid === null) {
                throw Error('Transfers require to uid');
            }
        }

        return await inTx(parent, async (ctx) => {
            // Update Accounts
            let fromAccount: Account | null = null;
            let toAccount: Account | null = null;
            if (fromUid !== null) {
                fromAccount = await this.getUserAccount(ctx, fromUid);
            }
            if (toUid !== null) {
                toAccount = await this.getUserAccount(ctx, toUid);
            }

            // Check source account
            if (fromAccount && fromAccount.balance < amount) {
                throw Error('Insufficient funds');
            }

            // Create Transaction
            let tx = await this.store.Transaction.create(ctx, uuid(), {
                secId: uuid(),
                fromAccount: fromAccount ? fromAccount.id : null,
                toAccount: toAccount ? toAccount.id : null,
                kind: kind,
                amount: amount,
                status: kind === 'transfer' ? 'processed' : 'pending'
            });

            // Create Transaction References
            if (fromAccount) {
                fromAccount.balance -= amount;
                await this.store.AccountTransaction.create(ctx, uuid(), { aid: fromAccount.id, txid: tx.id, amount: -amount, processed: true });
            }
            if (toAccount) {
                // Internal transfers are instant
                if (kind === 'transfer') {
                    toAccount.balance += amount;
                }
                await this.store.AccountTransaction.create(ctx, uuid(), { aid: toAccount.id, txid: tx.id, amount: amount, processed: kind === 'transfer' });
            }

            return tx;
        });
    }

    confirmTransaction = async (parent: Context, txid: string) => {
        return await inTx(parent, async (ctx) => {

            // Update Transaction Status
            let tx = await this.store.Transaction.findById(ctx, txid);
            if (!tx) {
                throw Error('Unable to find transaction');
            }
            if (tx.status === 'canceled' || tx.status === 'processed') {
                throw Error('Transaction is in completed state');
            }
            tx.status = 'processed';

            // Update destination balances
            if (tx.toAccount) {

                // Update Transaction
                let atx = await this.store.AccountTransaction.fromTransaction.find(ctx, tx.toAccount, txid);
                if (!atx) {
                    throw Error('Internal error');
                }
                if (atx.processed) {
                    throw Error('Internal error');
                }
                atx.processed = true;

                let account = await this.store.Account.findById(ctx, tx.toAccount);
                if (!account) {
                    throw Error('Internal error');
                }

                account.balance += atx.amount;
            }
            return tx;
        });
    }

    cancelTransaction = async (parent: Context, txid: string) => {
        return await inTx(parent, async (ctx) => {

            // Update Transaction Status
            let tx = await this.store.Transaction.findById(ctx, txid);
            if (!tx) {
                throw Error('Unable to find transaction');
            }
            if (tx.status === 'canceled' || tx.status === 'processed') {
                throw Error('Transaction is in completed state');
            }
            tx.status = 'canceled';

            // Update source balance
            if (tx.fromAccount) {

                // Update Transaction
                let atx = await this.store.AccountTransaction.fromTransaction.find(ctx, tx.fromAccount, txid);
                if (!atx) {
                    throw Error('Internal error');
                }
                if (!atx.processed) {
                    throw Error('Internal error');
                }
                atx.processed = false;

                let account = await this.store.Account.findById(ctx, tx.fromAccount);
                if (!account) {
                    throw Error('Internal error');
                }

                account.balance -= atx.amount;
            }

            return tx;
        });
    }
}