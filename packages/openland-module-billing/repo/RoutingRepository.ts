import { WalletRepository } from './WalletRepository';
import { Context } from '@openland/context';
import { Store, PaymentIntentCreateShape } from './../../openland-module-db/store';

export class RoutingRepository {

    readonly store: Store;
    readonly wallet: WalletRepository;

    constructor(store: Store, wallet: WalletRepository) {
        this.store = store;
        this.wallet = wallet;
    }

    routeSuccessfulPayment = async (ctx: Context, amount: number, pid: string | null, operation: PaymentIntentCreateShape['operation']) => {
        if (operation.type === 'deposit') {

            if (pid) {
                if (!operation.txid) {
                    throw Error('Transaction ID is missing');
                }

                // Confirm existing transaction
                await this.wallet.depositAsynCommit(ctx, operation.uid, operation.txid);
            } else {

                // Deposit instantly
                await this.wallet.depositInstant(ctx, operation.uid, amount);
            }
        }
    }

    routeFailingPayment = async (ctx: Context, amount: number, pid: string | null, operation: PaymentIntentCreateShape['operation']) => {
        if (pid) {
            if (!operation.txid) {
                throw Error('Transaction ID is missing');
            }

            // Change payment status
            await this.wallet.depositAsynFailing(ctx, operation.uid, operation.txid);
        }
    }

    routeActionNeededPayment = async (ctx: Context, amount: number, pid: string | null, operation: PaymentIntentCreateShape['operation']) => {
        if (pid) {
            if (!operation.txid) {
                throw Error('Transaction ID is missing');
            }

            // Change payment status
            await this.wallet.depositActionNeeded(ctx, operation.uid, operation.txid);
        }
    }
}