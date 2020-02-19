import { inTx } from '@openland/foundationdb';
import { WalletPurchaseCreateShape } from './../../openland-module-db/store';
import { Context } from '@openland/context';
import { Store } from '../../openland-module-db/store';
import { RoutingRepository } from './RoutingRepository';
import { WalletRepository } from './WalletRepository';
import { paymentAmounts } from './utils/paymentAmounts';
import uuid from 'uuid/v4';
import { PaymentsRepository } from './PaymentsRepository';

export class PurchaseRepository {

    readonly store: Store;
    readonly wallet: WalletRepository;
    readonly payments: PaymentsRepository;
    private routing!: RoutingRepository;

    constructor(store: Store, wallet: WalletRepository, payments: PaymentsRepository) {
        this.store = store;
        this.wallet = wallet;
        this.payments = payments;
    }

    setRouting = (routing: RoutingRepository) => {
        this.routing = routing;
    }

    createPurchase = async (parent: Context, uid: number, amount: number, product: WalletPurchaseCreateShape['product']) => {
        return await inTx(parent, async (ctx) => {
            let id = uuid();
            let availableBalance = await this.wallet.getAvailableBalance(ctx, uid);
            let amounts = paymentAmounts(availableBalance, amount);
            if (amounts.charge === 0) {

                // Wallet Transaction
                let txid = await this.wallet.purchaseCreatedInstant(ctx, id, uid, amounts.wallet);

                // Purchase
                let res = await this.store.WalletPurchase.create(parent, id, {
                    uid: uid,
                    amount: amount,
                    product: product,
                    state: 'success',
                    txid,
                    pid: null
                });

                // Callbacks
                if (this.routing.onPurchaseCreated) {
                    await this.routing.onPurchaseCreated(ctx, res.id, uid, amount, product);
                }
                if (this.routing.onPurchaseSuccessful) {
                    await this.routing.onPurchaseSuccessful(ctx, res.id, uid, amount, product);
                }
                return res;
            } else {
                let pid = uuid();

                // Payment
                await this.payments.createPayment(ctx, pid, uid, amount, { type: 'purchase', id: id });

                // Wallet Transaction
                let txid = await this.wallet.purchaseCreated(ctx, id, pid, uid, amounts.wallet, amounts.charge);

                // Purchase
                let res = await this.store.WalletPurchase.create(parent, id, {
                    uid: uid,
                    amount: amount,
                    product: product,
                    state: 'pending',
                    txid,
                    pid: pid
                });

                // Callbacks
                if (this.routing.onPurchaseCreated) {
                    await this.routing.onPurchaseCreated(ctx, res.id, uid, amount, product);
                }
                return res;
            }
        });
    }

    //
    // Purchase Handling
    //

    onPurchaseSuccessful = async (parent: Context, id: string) => {
        await inTx(parent, async (ctx) => {
            let purchase = (await this.store.WalletPurchase.findById(ctx, id))!;
            if (purchase.state !== 'pending') {
                throw Error('Unexpected state!');
            }
            purchase.state = 'success';

            // Update Wallet
            await this.wallet.purchaseSuccessful(ctx, purchase.uid, purchase.txid);

            // Do Routing
            if (this.routing.onPurchaseSuccessful) {
                await this.routing.onPurchaseSuccessful(ctx, id, purchase.uid, purchase.amount, purchase.product);
            }
        });
    }

    onPurchaseFailing = async (parent: Context, id: string) => {
        await inTx(parent, async (ctx) => {
            let purchase = (await this.store.WalletPurchase.findById(ctx, id))!;
            if (purchase.state !== 'pending') {
                throw Error('Unexpected state!');
            }

            // Update Wallet
            await this.wallet.purchaseFailing(ctx, purchase.uid, purchase.txid);

            // Do Routing
            if (this.routing.onPurchaseFailing) {
                await this.routing.onPurchaseFailing(ctx, purchase.id, purchase.uid, purchase.amount, purchase.product);
            }
        });
    }

    onPurchaseNeedAction = async (parent: Context, id: string) => {
        await inTx(parent, async (ctx) => {
            let purchase = (await this.store.WalletPurchase.findById(ctx, id))!;
            if (purchase.state !== 'pending') {
                throw Error('Unexpected state!');
            }

            // Update Wallet
            await this.wallet.purchaseActionNeeded(ctx, purchase.uid, purchase.txid);

            // Do Routing
            if (this.routing.onPurchaseNeedAction) {
                await this.routing.onPurchaseNeedAction(ctx, purchase.id, purchase.uid, purchase.amount, purchase.product);
            }
        });
    }

    onPurchaseCanceled = async (parent: Context, id: string) => {
        await inTx(parent, async (ctx) => {
            let purchase = (await this.store.WalletPurchase.findById(ctx, id))!;
            if (purchase.state !== 'pending') {
                throw Error('Unexpected state!');
            }
            purchase.state = 'canceled';

            // Update Wallet
            await this.wallet.purchaseCanceled(ctx, purchase.uid, purchase.txid);

            if (this.routing.onPurchaseCanceled) {
                await this.routing.onPurchaseCanceled(ctx, purchase.id, purchase.uid, purchase.amount, purchase.product);
            }
        });
    }
}