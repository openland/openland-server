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
        expYear: (src) => src.exp_year
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
        state: (src) => src.processed ? 'processed' : 'pending',
        readableState: (src) => src.processed ? 'Processed' : 'Pending'
    },
    WalletTransactionConnection: {
        items: (src) => src.items,
        cursor: (src) => src.cursor
    },

    Query: {
        myCards: withAccount(async (ctx, args, uid) => {
            let res = await Store.UserStripeCard.users.findAll(ctx, uid);
            res.sort((a, b) => a.metadata.createdAt - b.metadata.createdAt);
            return res;
        }),
        myAccount: withAccount(async (ctx, args, uid) => {
            return await Modules.Billing.repo.getUserAccount(ctx, uid);
        }),
        walletTransactions: withAccount(async (ctx, args, uid) => {
            let account = await Modules.Billing.repo.getUserAccount(ctx, uid);
            let txs = await Store.AccountTransaction.fromAccount.findAll(ctx, account.id);
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

        cardDepositIntent: withAccount(async (ctx, args, uid) => {
            return await Modules.Billing.createDepositIntent(ctx, uid, IDs.CreditCard.parse(args.id), args.amount, args.retryKey);
        }),
        cardDepositIntentCommit: withAccount(async (ctx, args, uid) => {
            await Modules.Billing.updatePaymentIntent(ctx, IDs.PaymentIntent.parse(args.id));
            return true;
        })
    }
} as GQLResolver;