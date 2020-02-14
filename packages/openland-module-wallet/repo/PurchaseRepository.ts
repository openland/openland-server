import { inTx } from '@openland/foundationdb';
import { WalletPurchaseCreateShape } from './../../openland-module-db/store';
import { Context } from '@openland/context';
import { Store } from '../../openland-module-db/store';
import { RoutingRepository } from './RoutingRepository';
import { WalletRepository } from './WalletRepository';
import { paymentAmounts } from './utils/paymentAmounts';
import uuid from 'uuid/v4';

export class PurchaseRepository {

    readonly store: Store;
    readonly wallet: WalletRepository;
    private routing!: RoutingRepository;

    constructor(store: Store, wallet: WalletRepository) {
        this.store = store;
        this.wallet = wallet;
    }

    setRouting = (routing: RoutingRepository) => {
        this.routing = routing;
    }

    createPurchase = async (parent: Context, uid: number, amount: number, product: WalletPurchaseCreateShape['product']) => {
        return await inTx(parent, async (ctx) => {
            let id = uuid();
            let availableBalance = await this.wallet.getAvailableBalance(ctx, uid);
            let amounts = paymentAmounts(availableBalance, amount);
            await this.wallet.purchaseCreated(ctx, uid, amount, amounts.wallet);
            if (amounts.charge === 0) {
                await this.wallet.purchaseSuccessful(ctx, uid, amount, amounts.wallet, id, null);
                if (this.routing.onPurchaseSuccessful) {
                    await this.routing.onPurchaseSuccessful(ctx, uid, amount, product);
                }
                return await this.store.WalletPurchase.create(parent, id, {
                    uid: uid,
                    amount: amount,
                    product: product,
                    state: 'success',
                    succeededAt: Date.now(),
                    pid: null,
                    lockedAmount: 0
                });
            } else {
                return await this.store.WalletPurchase.create(parent, id, {
                    uid: uid,
                    amount: amount,
                    product: product,
                    state: 'pending',
                    succeededAt: null,
                    pid: null,
                    lockedAmount: amounts.wallet
                });
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
            purchase.succeededAt = Date.now();

            // Update Wallet
            await this.wallet.purchaseSuccessful(ctx, purchase.uid, purchase.amount, purchase.lockedAmount, id, purchase.pid);

            // Do Routing
            if (this.routing.onPurchaseSuccessful) {
                await this.routing.onPurchaseSuccessful(ctx, purchase.uid, purchase.amount, purchase.product);
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
            await this.wallet.purchaseCanceled(ctx, purchase.uid, purchase.amount, purchase.lockedAmount);

            if (this.routing.onPurchaseCanceled) {
                await this.routing.onPurchaseCanceled(ctx, purchase.uid, purchase.amount, purchase.product);
            }
        });
    }
}