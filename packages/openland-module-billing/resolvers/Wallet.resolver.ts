import { LiveStreamItem, BaseEvent } from '@openland/foundationdb-entity';
import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { withAccount } from 'openland-module-api/Resolvers';
import { IDs } from 'openland-module-api/IDs';
import { GQLResolver, GQL } from 'openland-module-api/schema/SchemaSpec';
import { AppContext } from 'openland-modules/AppContext';
import { WalletBalanceChanged, WalletTransactionPending, WalletTransactionSuccess, WalletTransactionCanceled, PaymentStatusChanged } from 'openland-module-db/store';
import { randomKey } from 'openland-utils/random';

export default {
    CreditCard: {
        id: (src) => IDs.CreditCard.serialize(src.pmid),
        pmid: (src) => src.pmid,
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
        id: (src) => IDs.WalletAccount.serialize(src.uid),
        balance: (src) => src.balance,
        state: async (src, args, ctx) => IDs.WalletUpdatesCursor.serialize(await Store.UserWalletUpdates.createStream(src.uid, { batchSize: 20 }).tail(ctx) || '')
    },

    WalletTransaction: {
        id: (src) => IDs.WalletTransaction.serialize(src.id),
        date: (src) => src.metadata.createdAt + '',
        status: (src) => {
            if (src.status === 'success') {
                return 'SUCCESS';
            } else if (src.status === 'canceled') {
                return 'CANCELED';
            } else if (src.status === 'canceling') {
                return 'CANCELING';
            } else if (src.status === 'pending') {
                return 'PENDING';
            }
            throw Error('Unknown transaction status: ' + src.status);
        },
        operation: (src) => src.operation
    },

    //
    // Operations
    //

    WalletTransactionOperation: {
        __resolveType: (src) => {
            if (src.type === 'deposit') {
                return 'WalletTransactionDeposit';
            } else if (src.type === 'subscription') {
                return 'WalletTransactionSubscription';
            } else if (src.type === 'transfer_out') {
                return 'WalletTransactionTransferOut';
            } else if (src.type === 'transfer_in') {
                return 'WalletTransactionTransferIn';
            }

            throw Error('Unknown operation type: ' + (src as any /* Fuck you, ts */).type);
        }
    },
    WalletTransactionDeposit: {
        amount: (src) => (src as any).amount,
        payment: (src, args, ctx) => (src as any).payment && Store.Payment.findById(ctx, (src as any).payment!)
    },
    WalletTransactionSubscription: {
        amount: (src) => (src as any).chargeAmount,
        payment: async (src, args, ctx) => {
            let subscription = (src as any).subscription;
            let index = (src as any).index;
            let period = (await Store.WalletSubscriptionPeriod.findById(ctx, subscription, index))!;
            if (period.pid) {
                return Store.Payment.findById(ctx, period.pid);
            } else {
                return null;
            }
        }
    },
    WalletTransactionTransferIn: {
        amount: (src) => (src as any).amount,
        fromUser: (src) => (src as any).fromUser
    },
    WalletTransactionTransferOut: {
        walletAmount: (src) => (src as any).walletAmount,
        chargeAmount: (src) => {
            return (src as any).chargeAmount;
        },
        payment: (src, args, ctx) => (src as any).payment && Store.Payment.findById(ctx, (src as any).payment!.id),
        toUser: (src) => (src as any).toUser
    },

    Payment: {
        id: (src) => IDs.Payment.serialize(src.id),
        status: (src) => {
            if (src.state === 'pending') {
                return 'PENDING';
            } else if (src.state === 'canceled') {
                return 'CANCELED';
            } else if (src.state === 'failing') {
                return 'FAILING';
            } else if (src.state === 'success') {
                return 'SUCCESS';
            } else if (src.state === 'action_required') {
                return 'ACTION_REQUIRED';
            }
            return 'PENDING';
        },
        intent: async (src, args, ctx) => {
            if (src.state === 'action_required' || src.state === 'failing') {
                return (await Modules.Billing.paymentsMediator.stripe.paymentIntents.retrieve(src.piid!));
            }

            return null;
        }
    },

    Query: {
        myCards: withAccount(async (ctx, args, uid) => {
            let res = (await Store.UserStripeCard.users.findAll(ctx, uid))
                .filter((v) => !v.deleted);
            res.sort((a, b) => a.metadata.createdAt - b.metadata.createdAt);
            return res;
        }),
        myWallet: withAccount(async (ctx, args, uid) => {
            return await Modules.Billing.wallet.getWallet(ctx, uid);
        }),

        //
        // Transactions
        //

        transactionsPending: withAccount(async (ctx, args, uid) => {
            let res = await Store.WalletTransaction.pending.findAll(ctx, uid);
            return res.reverse();
        }),
        transactionsHistory: withAccount(async (ctx, args, uid) => {
            let after = args.after ? IDs.WalletTransactionsCursor.parse(args.after) : undefined;
            let res = await Store.WalletTransaction.history.query(ctx, uid, { reverse: true, afterCursor: after, limit: args.first });
            return {
                items: res.items,
                cursor: res.cursor ? IDs.WalletTransactionsCursor.serialize(res.cursor) : null
            };
        })
    },
    Mutation: {

        //
        // Cards
        //

        cardCreateSetupIntent: withAccount(async (ctx, args, uid) => {
            return await Modules.Billing.createSetupIntent(ctx, uid, args.retryKey);
        }),
        cardCommitSetupIntent: withAccount(async (ctx, args, uid) => {
            return await Modules.Billing.registerCard(ctx, uid, args.pmid);
        }),
        cardMakeDefault: withAccount(async (ctx, args, uid) => {
            return await Modules.Billing.makeCardDefault(ctx, uid, IDs.CreditCard.parse(args.id));
        }),
        cardRemove: withAccount(async (ctx, args, uid) => {
            return await Modules.Billing.deleteCard(ctx, uid, IDs.CreditCard.parse(args.id));
        }),

        //
        // Deposits
        //

        cardDepositEnqueue: withAccount(async (ctx, args, uid) => {
            await Modules.Billing.paymentsMediator.createDepositPayment(ctx, uid, args.amount, args.retryKey);
            return true;
        }),
        cardDepositIntent: withAccount(async (ctx, args, uid) => {
            return await Modules.Billing.createDepositIntent(ctx, uid, IDs.CreditCard.parse(args.id), args.amount, args.retryKey);
        }),

        //
        // Payment Intent
        //

        paymentIntentCommit: withAccount(async (ctx, args, uid) => {
            await Modules.Billing.updatePaymentIntent(ctx, IDs.PaymentIntent.parse(args.id));
            return true;
        }),
        paymentCancel: withAccount(async (ctx, args, uid) => {
            return await Modules.Billing.paymentsMediator.tryCancelPaymentIntent(ctx, uid, IDs.Payment.parse(args.id));
        }),

        //
        // Donate
        //

        donateToUser: withAccount(async (ctx, args, uid) => {
            // await Modules.Billing.createSubscription(ctx, uid, args.amount, 'week', {
            //     type: 'donate',
            //     uid: IDs.User.parse(args.id)
            // });
            await Modules.Billing.paymentsMediator.createTransferPayment(ctx, uid, IDs.User.parse(args.id), args.amount, 'donate-' + randomKey());
            return true;
        }),
    },

    //
    // Update Containers
    //

    WalletUpdateContainer: {
        __resolveType(obj: LiveStreamItem<BaseEvent>) {
            if (obj.items.length === 1) {
                return 'WalletUpdateSingle';
            } else {
                return 'WalletUpdateBatch';
            }
        }
    },
    WalletUpdateBatch: {
        updates: src => src.items,
        state: src => IDs.WalletUpdatesCursor.serialize(src.cursor || '')
    },
    WalletUpdateSingle: {
        state: src => IDs.WalletUpdatesCursor.serialize(src.cursor || ''),
        update: src => src.items[0],
    },

    //
    // Updates
    //

    WalletUpdate: {
        __resolveType(obj: BaseEvent) {
            if (obj instanceof WalletBalanceChanged) {
                return 'WalletUpdateBalance';
            } else if (obj instanceof WalletTransactionPending) {
                return 'WalletUpdateTransactionPending';
            } else if (obj instanceof WalletTransactionSuccess) {
                return 'WalletUpdateTransactionSuccess';
            } else if (obj instanceof WalletTransactionCanceled) {
                return 'WalletUpdateTransactionCanceled';
            } else if (obj instanceof PaymentStatusChanged) {
                return 'WalletUpdatePaymentStatus';
            }
            throw Error('Unknown event type: ' + obj.type);
        }
    },
    WalletUpdateBalance: {
        amount: (src) => src.amount
    },
    WalletUpdateTransactionPending: {
        transaction: (src, args, ctx) => Store.WalletTransaction.findById(ctx, src.id)
    },
    WalletUpdateTransactionSuccess: {
        transaction: (src, args, ctx) => Store.WalletTransaction.findById(ctx, src.id)
    },
    WalletUpdateTransactionCanceled: {
        transaction: (src, args, ctx) => Store.WalletTransaction.findById(ctx, src.id)
    },
    WalletUpdatePaymentStatus: {
        payment: (src, args, ctx) => Store.Payment.findById(ctx, src.id)
    },

    Subscription: {
        walletUpdates: {
            resolve: async (msg: any) => {
                return msg;
            },
            subscribe: async function* (r: any, args: GQL.SubscriptionWalletUpdatesArgs, ctx: AppContext) {
                let stream = Store.UserWalletUpdates.createLiveStream(ctx, ctx.auth.uid!, { batchSize: 20, after: IDs.WalletUpdatesCursor.parse(args.fromState) });
                for await (let event of stream) {
                    yield event;
                }
            }
        }
    }
} as GQLResolver;