import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { withAccount } from 'openland-module-api/Resolvers';
import { IDs } from 'openland-module-api/IDs';
import { GQLResolver } from 'openland-module-api/schema/SchemaSpec';

export default {
    CreditCard: {
        id: (src) => IDs.CreditCard.serialize(src.pmid),
        brand: (src) => src.brand,
        last4: (src) => src.last4,
        expMonth: (src) => src.exp_month,
        expYear: (src) => src.exp_year,
        deleted: (src) => src.deleted,
        isDefault: (src) => src.default
    },
    CardSetupIntent: {
        id: (src) => IDs.CreditCardSetupIntent.serialize(src.id),
        clientSecret: (src) => src.client_secret
    },
    PaymentIntent: {
        id: (src) => IDs.PaymentIntent.serialize(src.id),
        clientSecret: (src) => src.client_secret
    },

    WalletAccount: {
        id: (src) => IDs.WalletAccount.serialize(src.id),
        balance: (src) => src.balance
    },
    WalletTransaction: {
        id: (src) => IDs.WalletTransaction.serialize(src.id),
        amount: (src) => src.amount,
        extraAmount: async (src, args, ctx) => {
            return (await Store.Transaction.findById(ctx, src.txid))!.extraAmount;
        },
        state: (src) => src.processed ? 'processed' : 'pending',
        readableState: (src) => src.processed ? 'Processed' : 'Pending',
        type: async (src, args, ctx) => {
            let kind = (await Store.Transaction.findById(ctx, src.txid))!.kind;
            if (kind === 'deposit') {
                return 'DEPOSIT';
            } else if (kind === 'withdraw') {
                return 'WITHDRAW';
            } else if (kind === 'transfer') {
                return 'TRANSFER';
            } else if (kind === 'purchase') {
                return 'PURCHASE';
            }
            throw Error('Unknown kind ' + kind);
        }
    },
    WalletTransactionConnection: {
        items: (src) => src.items,
        cursor: (src) => src.cursor
    },

    PaidSubscription: {
        id: (src) => IDs.PaidSubscription.serialize(src.psid),
        title: (src) => 'Test Subscription of ' + src.amount,
        amount: (src) => src.amount,
        interval: async (src) => src.interval === 'yearly' ? 'YEARLY' : 'MONTHLY',
        status: async (src) => src.state === 'enabled' ? 'ACTIVE' : 'CANCELED',
    },

    Query: {
        myCards: withAccount(async (ctx, args, uid) => {
            let res = (await Store.UserStripeCard.users.findAll(ctx, uid))
                .filter((v) => !v.deleted);
            res.sort((a, b) => a.metadata.createdAt - b.metadata.createdAt);
            return res;
        }),
        myAccount: withAccount(async (ctx, args, uid) => {
            return await Modules.Billing.repo.getUserAccount(ctx, uid);
        }),
        mySubscriptions: withAccount(async (ctx, args, uid) => {
            return await Store.UserAccountSubscription.findAll(ctx);
        }),
        walletTransactions: withAccount(async (ctx, args, uid) => {
            let account = await Modules.Billing.repo.getUserAccount(ctx, uid);
            let txs = await Store.AccountTransaction.fromAccount.findAll(ctx, account.id);
            txs.sort((a, b) => b.metadata.createdAt - a.metadata.createdAt);
            return {
                items: txs,
                cursor: undefined
            };
        })
    },
    Mutation: {
        cardCreateSetupIntent: withAccount(async (ctx, args, uid) => {
            return await Modules.Billing.createSetupIntent(ctx, uid, args.retryKey);
        }),
        cardCommitSetupIntent: withAccount(async (ctx, args, uid) => {
            // TODO: Validate Setup Intent
            return await Modules.Billing.registerCard(ctx, uid, args.pmid);
        }),
        cardDepositEnqueue: withAccount(async (ctx, args, uid) => {
            await Modules.Billing.paymentsMediator.createPayment(ctx, uid, args.amount, args.retryKey, { type: 'deposit', uid: uid });
            return true;
        }),
        cardDepositIntent: withAccount(async (ctx, args, uid) => {
            return await Modules.Billing.createDepositIntent(ctx, uid, IDs.CreditCard.parse(args.id), args.amount, args.retryKey);
        }),
        cardDepositIntentCommit: withAccount(async (ctx, args, uid) => {
            await Modules.Billing.updatePaymentIntent(ctx, IDs.PaymentIntent.parse(args.id));
            return true;
        }),
        cardRemove: withAccount(async (ctx, args, uid) => {
            return await Modules.Billing.deleteCard(ctx, uid, IDs.CreditCard.parse(args.id));
        }),
        cardMakeDefault: withAccount(async (ctx, args, uid) => {
            return await Modules.Billing.makeCardDefault(ctx, uid, IDs.CreditCard.parse(args.id));
        }),
        subscriptionCreateDonate: withAccount(async (ctx, args, uid) => {
            // return Modules.Billing.repo.createDonateSubscription(ctx, uid, 2, args.amount, args.retryKey);
            throw Error('');
        })
    }
} as GQLResolver;