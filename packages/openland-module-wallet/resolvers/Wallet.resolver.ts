import { LiveStreamItem, BaseEvent } from '@openland/foundationdb-entity';
import { Modules } from 'openland-modules/Modules';
import { Store } from 'openland-module-db/FDB';
import { withAccount } from 'openland-module-api/Resolvers';
import { IDs } from 'openland-module-api/IDs';
import { GQLResolver, GQL } from 'openland-module-api/schema/SchemaSpec';
import { AppContext } from 'openland-modules/AppContext';
import { WalletBalanceChanged, WalletTransactionPending, WalletTransactionSuccess, WalletTransactionCanceled, PaymentStatusChanged, WalletLockedChanged, WalletSubscription, WalletPurchase } from 'openland-module-db/store';
import { randomKey } from 'openland-utils/random';
import { NotFoundError } from 'openland-errors/NotFoundError';
import { AccessDeniedError } from 'openland-errors/AccessDeniedError';
import { inTx } from '@openland/foundationdb';

export const Resolver: GQLResolver = {
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
        clientSecret: (src) => src.client_secret!
    },
    PaymentIntent: {
        id: (src) => IDs.PaymentIntent.serialize(src.id),
        clientSecret: (src) => src.client_secret!,
        card: (src, args, ctx) => {
            if (typeof src.payment_method === 'string') {
                return Store.UserStripeCard.pmid.find(ctx, src.payment_method);
            } else if (src.payment_method) {
                return Store.UserStripeCard.pmid.find(ctx, src.payment_method.id);
            }
            return null;
        }
    },

    WalletAccount: {
        id: (src) => IDs.WalletAccount.serialize(src.uid),
        balance: (src) => src.balance,
        state: async (src, args, ctx) => IDs.WalletUpdatesCursor.serialize(await Store.UserWalletUpdates.createStream(src.uid, { batchSize: 20 }).tail(ctx) || ''),
        isLocked: (src, args, ctx) => Modules.Wallet.isLocked(ctx, src.uid),
        failingPaymentsCount: (src, args, ctx) => Modules.Wallet.getFailingPaymentsCount(ctx, src.uid),
    },

    WalletTransaction: {
        id: (src) => IDs.WalletTransaction.serialize(src.id),
        date: (src) => src.metadata.createdAt + '',
        status: (src) => {
            if (src.status === 'success') {
                return 'SUCCESS';
            } else if (src.status === 'canceled') {
                return 'CANCELED';
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
            } else if (src.type === 'income') {
                return 'WalletTransactionIncome';
            } else if (src.type === 'subscription') {
                return 'WalletTransactionSubscription';
            } else if (src.type === 'purchase') {
                return 'WalletTransactionPurchase';
            } else if (src.type === 'transfer_out') {
                return 'WalletTransactionTransferOut';
            } else if (src.type === 'transfer_in') {
                return 'WalletTransactionTransferIn';
            }

            throw Error('Unknown operation type: ' + (src as any /* Fuck you, ts */).type);
        }
    },
    //
    // IN
    //
    WalletTransactionDeposit: {
        amount: (src) => (src as any).amount,
        payment: (src, args, ctx) => (src as any).payment && Store.Payment.findById(ctx, (src as any).payment!)
    },
    WalletTransactionIncome: {
        amount: (src) => (src as any).amount,
        source: (src, args, ctx) => {
            if (src.type === 'income') {
                if (src.source === 'purchase') {
                    return Store.WalletPurchase.findById(ctx, src.id);
                } else if (src.source === 'subscription') {
                    return Store.WalletSubscription.findById(ctx, src.id);
                } else {
                    throw new Error(`Unknown income source: ${src.source}`);
                }
            } else {
                throw new Error('Internal error');
            }
        }
    },
    WalletTransactionTransferIn: {
        amount: (src) => (src as any).amount,
        fromUser: (src) => (src as any).fromUser
    },
    //
    // OUT
    //
    WalletTransactionSubscription: {
        amount: (src) => ((src as any).chargeAmount + (src as any).walletAmount) * -1,
        chargeAmount: (src) => (src as any).chargeAmount,
        walletAmount: (src) => (src as any).walletAmount,
        payment: async (src, args, ctx) => {
            let subscription = (src as any).subscription;
            let index = (src as any).index;
            let period = (await Store.WalletSubscriptionPeriod.findById(ctx, subscription, index))!;
            if (period.pid) {
                return Store.Payment.findById(ctx, period.pid);
            } else {
                return null;
            }
        },
        subscription: async (src, srgs, ctx) => (await Store.WalletSubscription.findById(ctx, (src as any).subscription))!
    },
    WalletTransactionPurchase: {
        amount: (src) => ((src as any).chargeAmount + (src as any).walletAmount) * -1,
        chargeAmount: (src) => (src as any).chargeAmount,
        walletAmount: (src) => (src as any).walletAmount,
        payment: async (src, args, ctx) => {
            if (src.type === 'purchase' && src.payment.type === 'payment') {
                return Store.Payment.findById(ctx, src.payment.id);
            }

            return null;
        },
        purchase: async (src, srgs, ctx) => (await Store.WalletPurchase.findById(ctx, (src as any).purchase))!
    },
    WalletTransactionTransferOut: {
        amount: (src) => ((src as any).chargeAmount + (src as any).walletAmount) * -1,
        chargeAmount: (src) => (src as any).chargeAmount,
        walletAmount: (src) => (src as any).walletAmount,
        payment: async (src, args, ctx) => {
            if (src.type === 'transfer_out' && src.payment.type === 'payment') {
                return Store.Payment.findById(ctx, src.payment.id);
            }

            return null;
        },
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
                return (await Modules.Wallet.paymentsMediator.stripe.paymentIntents.retrieve(src.piid!));
            }

            return null;
        },
        card: async (src, args, ctx) => {
            if (!src.piid) {
                return null;
            }
            let intent = await Modules.Wallet.paymentsMediator.stripe.paymentIntents.retrieve(src.piid);
            if (typeof intent.payment_method === 'string') {
                return Store.UserStripeCard.pmid.find(ctx, intent.payment_method);
            } else if (intent.payment_method) {
                return Store.UserStripeCard.pmid.find(ctx, intent.payment_method.id);
            }
            return null;
        }
    },

    Purchase: {
        id: (src) => IDs.Purchase.serialize(src.id),
        state: (src) => src.state === 'success' ? 'COMPLETED' : (src.state === 'pending' ? 'PENDING' : 'CANCELED'),
        intent: async (src, args, ctx) => {
            if (src.state === 'pending') {
                return (await Modules.Wallet.paymentsMediator.stripe.paymentIntents.retrieve(src.pid!));
            }

            return null;
        },
        product: (src) => src.product
    },

    WalletIncomeSource: {
        __resolveType: (src) => {
            if (src instanceof WalletSubscription) {
                return 'WalletSubscription';
            } else if (src instanceof WalletPurchase) {
                return 'Purchase';
            }
            throw Error('Unknown source type');
        }
    },

    //
    // Subscriptions
    //

    WalletSubscription: {
        id: (src) => IDs.PaidSubscription.serialize(src.id),
        amount: (src) => src.amount,
        state: (src) => {
            if (src.state === 'started') {
                return 'STARTED';
            } else if (src.state === 'grace_period') {
                return 'GRACE_PERIOD';
            } else if (src.state === 'retrying') {
                return 'RETRYING';
            } else if (src.state === 'canceled') {
                return 'CANCELED';
            } else if (src.state === 'expired') {
                return 'EXPIRED';
            }
            throw Error('Unknown subscription state: ' + src.state);
        },
        interval: (src) => {
            if (src.interval === 'month') {
                return 'MONTH';
            } else if (src.interval === 'week') {
                return 'WEEK';
            }
            throw Error('Unknown subscription interval: ' + src.interval);
        },
        product: (src) => src.proudct,
        expires: async (src, arg, ctx) => await Modules.Wallet.subscriptions.resolveSubscriptionExpires(ctx, src.id)
    },

    WalletProduct: {
        __resolveType: (src) => {
            if (src.type === 'group') {
                return 'WalletProductGroup';
            } else if (src.type === 'donate') {
                return 'WalletProductDonation';
            }
            throw Error('Unknown product type: ' + (src as any /* Fuck you, ts */).type);
        }
    },

    WalletProductGroup: {
        group: (src) => {
            if (src.type === 'group' && src.gid) {
                return src.gid;
            }
            throw new Error('Internal error');
        }
    },

    WalletProductDonation: {
        user: (src) => {
            if (src.type === 'donate' && src.uid) {
                return src.uid;
            }
            throw new Error('Internal error');
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
            return await Modules.Wallet.getWallet(ctx, uid);
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
        }),

        //
        // Sybscriptions
        //

        subscriptions: withAccount(async (ctx, args, uid) => {
            return await Store.WalletSubscription.user.findAll(ctx, uid);
        })
    },
    Mutation: {

        //
        // Cards
        //

        cardCreateSetupIntent: withAccount(async (ctx, args, uid) => {
            return await Modules.Wallet.createSetupIntent(ctx, uid, args.retryKey);
        }),
        cardCommitSetupIntent: withAccount(async (ctx, args, uid) => {
            return (await Modules.Wallet.registerCard(ctx, uid, args.pmid))!;
        }),
        cardMakeDefault: withAccount(async (ctx, args, uid) => {
            return (await Modules.Wallet.makeCardDefault(ctx, uid, IDs.CreditCard.parse(args.id)))!;
        }),
        cardRemove: withAccount(async (ctx, args, uid) => {
            return (await Modules.Wallet.deleteCard(ctx, uid, IDs.CreditCard.parse(args.id)))!;
        }),

        //
        // Deposits
        //

        cardDepositEnqueue: withAccount(async (ctx, args, uid) => {
            await Modules.Wallet.createDepositPayment(ctx, uid, args.amount, args.retryKey);
            return true;
        }),
        cardDepositIntent: withAccount(async (ctx, args, uid) => {
            return await Modules.Wallet.createDepositIntent(ctx, uid, IDs.CreditCard.parse(args.id), args.amount, args.retryKey);
        }),

        //
        // Payment Intent
        //

        paymentIntentCommit: withAccount(async (ctx, args, uid) => {
            await Modules.Wallet.updatePaymentIntent(ctx, IDs.PaymentIntent.parse(args.id));
            return true;
        }),
        paymentCancel: withAccount(async (ctx, args, uid) => {
            throw Error('Unsupported');
        }),

        //
        // Donate
        //

        donateToUser: withAccount(async (ctx, args, uid) => {
            // await Modules.Billing.createSubscription(ctx, uid, args.amount, 'week', {
            //     type: 'donate',
            //     uid: IDs.User.parse(args.id)
            // });
            await Modules.Wallet.createTransferPayment(ctx, uid, IDs.User.parse(args.id), args.amount, 'donate-' + randomKey());
            return true;
        }),
        donateToUser2: withAccount(async (ctx, args, uid) => {
            return await Modules.Wallet.purchases.createPurchase(ctx, uid, args.amount, { type: 'donate', uid: IDs.User.parse(args.id) });
        }),

        //
        // Subscriptions
        //

        subscriptionCancel: withAccount(async (parent, args, uid) => {
            return await inTx(parent, async (ctx) => {
                let subscription = await Store.WalletSubscription.findById(ctx, IDs.PaidSubscription.parse(args.id));
                if (!subscription) {
                    throw new NotFoundError();
                }
                if (subscription.uid !== uid) {
                    throw new AccessDeniedError();
                }
                await Modules.Wallet.subscriptions.tryCancelSubscription(ctx, subscription.id);
                return subscription;
            });
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
            } else if (obj instanceof WalletLockedChanged) {
                return 'WalletUpdateLocked';
            }

            throw Error('Unknown event type: ' + obj.type);
        }
    },
    WalletUpdateBalance: {
        amount: (src) => src.amount
    },
    WalletUpdateTransactionPending: {
        transaction: async (src, args, ctx) => (await Store.WalletTransaction.findById(ctx, src.id))!
    },
    WalletUpdateTransactionSuccess: {
        transaction: async (src, args, ctx) => (await Store.WalletTransaction.findById(ctx, src.id))!
    },
    WalletUpdateTransactionCanceled: {
        transaction: async (src, args, ctx) => (await Store.WalletTransaction.findById(ctx, src.id))!
    },
    WalletUpdatePaymentStatus: {
        payment: async (src, args, ctx) => (await Store.Payment.findById(ctx, src.id))!
    },
    WalletUpdateLocked: {
        isLocked: (src, args, ctx) => Modules.Wallet.isLocked(ctx, ctx.auth.uid!),
        failingPaymentsCount: (src, args, ctx) => Modules.Wallet.getFailingPaymentsCount(ctx, ctx.auth.uid!),
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
};
