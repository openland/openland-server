import { uuid } from 'openland-utils/uuid';
import { WorkQueue } from 'openland-module-workers/WorkQueue';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { Store, Account, PaymentCreateShape } from './../../openland-module-db/store';

export class BillingRepository {

    private readonly store: Store;
    readonly createCustomerQueue = new WorkQueue<{ uid: number }, { result: string }>('stripe-customer-export-task', -1);
    readonly syncCardQueue = new WorkQueue<{ uid: number, pmid: string }, { result: string }>('stripe-customer-export-card-task', -1);
    readonly paymentProcessorQueue = new WorkQueue<{ uid: number, pid: string }, { result: string }>('stripe-payment-task', -1);

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

    enableBilling = async (parent: Context, uid: number) => {
        return await inTx(parent, async (ctx) => {

            // Check if user exists
            let user = await this.store.User.findById(ctx, uid);
            if (!user) {
                throw Error('Unable to find user');
            }

            // Check if profile exists
            let profile = await this.store.UserProfile.findById(ctx, uid);
            if (!profile) {
                throw Error('Unable to enable billing without profile');
            }

            // Check for double enable
            let customer = await this.store.UserStripeCustomer.findById(ctx, uid);
            if (customer) {
                throw Error('Billing already enabled for user');
            }

            // Create Customer
            await this.store.UserStripeCustomer.create(ctx, uid, { uniqueKey: uuid() });

            // Schedule work to register customer
            await this.createCustomerQueue.pushWork(ctx, { uid });
        });
    }

    //
    // Payment
    //

    createPayment = async (parent: Context, uid: number, toUid: number, amount: number, operation: PaymentCreateShape['operation']) => {
        return await inTx(parent, async (ctx) => {

            let fromAccount = await this.getUserAccount(ctx, uid);
            let toAccount = await this.getUserAccount(ctx, toUid);
            if (fromAccount.balance >= amount) {

                //
                // Pay from balance
                //

                let txId = uuid();
                await this.store.Transaction.create(ctx, txId, {
                    secId: uuid(),
                    fromAccount: fromAccount.id,
                    toAccount: toAccount.id,
                    kind: 'purchase',
                    amount: amount,
                    status: 'processed'
                });

                //
                // Create Transaction References
                //
                toAccount.balance += amount;
                fromAccount.balance -= amount;
                await this.store.AccountTransaction.create(ctx, uuid(), { aid: fromAccount.id, txid: txId, amount: -amount, processed: true });
                await this.store.AccountTransaction.create(ctx, uuid(), { aid: toAccount.id, txid: txId, amount: amount, processed: true });

                //
                // Payment
                //

                return await this.store.Payment.create(ctx, uuid(), {
                    uid: uid,
                    state: 'success',
                    amount: 0,
                    walletAmount: amount,
                    operation: operation
                });
            } else {

                let walletAmount = fromAccount.balance;
                let extraAmount = amount - fromAccount.balance;

                //
                // Pay from balance
                //

                let txId = uuid();
                await this.store.Transaction.create(ctx, txId, {
                    secId: uuid(),
                    fromAccount: fromAccount.id,
                    toAccount: toAccount.id,
                    kind: 'purchase',
                    amount: amount,
                    extraAmount: extraAmount,
                    status: 'pending'
                });

                // Adjust basic balance
                fromAccount.balance -= walletAmount;

                await this.store.AccountTransaction.create(ctx, uuid(), { aid: fromAccount.id, txid: txId, amount: -walletAmount, processed: true });
                await this.store.AccountTransaction.create(ctx, uuid(), { aid: toAccount.id, txid: txId, amount: amount, processed: false });

                let payment = await this.store.Payment.create(ctx, uuid(), {
                    uid: uid,
                    state: 'pending',
                    walletAmount: walletAmount,
                    amount: extraAmount,
                    operation: operation
                });
                await this.paymentProcessorQueue.pushWork(ctx, { uid: uid, pid: payment.id });
                return payment;
            }
        });
    }

    //
    // Subscription
    //

    createDonateSubscription = async (parent: Context, uid: number, toUid: number, amount: number, retryKey: string) => {
        return await inTx(parent, async (ctx) => {

            let ex = await this.store.UserAccountSubscription.retry.find(ctx, uid, retryKey);
            if (ex) {
                return ex;
            }

            let subs = this.createSubscription(ctx, uid, toUid, amount);
            return await this.store.UserAccountSubscription.create(ctx, uid, (await subs).id, {
                amount: amount,
                state: 'enabled',
                interval: 'monthly',
                kind: { type: 'donate' },
                retryKey: retryKey
            });
        });
    }

    createSubscription = async (parent: Context, uid: number, toUid: number, amount: number) => {
        return await inTx(parent, async (ctx) => {
            let date = Date.now();

            //
            // Create Subscription Object
            //

            let subscription = await this.store.PaidSubscription.create(ctx, uuid(), {
                uid: uid,
                toUid: toUid,
                interval: 'monthly',
                startDate: date,
                amount: amount,
                state: 'enabled',
            });

            //
            // Register First Payment
            //

            let pspid = uuid();
            let payment = await this.createPayment(ctx, uid, toUid, amount, { type: 'subscription', pspid: pspid });
            await this.store.PaidSubscriptionPayment.create(ctx, pspid, {
                uid: uid,
                sid: subscription.id,
                pid: payment.id,
                date: date
            });
            return subscription;
        });
    }

    cancelSubscription = async (parent: Context, sid: string) => {
        return await inTx(parent, async (ctx) => {
            let subs = (await this.store.PaidSubscription.findById(ctx, sid))!;
            subs.state = 'canceled';
        });
    }
}