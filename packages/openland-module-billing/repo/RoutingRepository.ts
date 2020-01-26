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

    //
    // Off-Session Payments
    //

    routeSuccessfulPayment = async (ctx: Context, amount: number, pid: string, operation: PaymentIntentCreateShape['operation']) => {
        if (operation.type === 'deposit') {
            if (!operation.txid) {
                throw Error('Transaction ID is missing');
            }

            // Confirm existing transaction
            await this.wallet.depositAsyncCommit(ctx, operation.uid, operation.txid);
        } else {
            throw Error('Unknown operation type');
        }
    }

    routeFailingPayment = async (ctx: Context, amount: number, pid: string, operation: PaymentIntentCreateShape['operation']) => {
        if (operation.type === 'deposit') {
            if (!operation.txid) {
                throw Error('Transaction ID is missing');
            }

            // Change payment status
            await this.wallet.depositAsyncFailing(ctx, operation.uid, operation.txid);
        } else {
            throw Error('Unknown operation type');
        }
    }

    routeActionNeededPayment = async (ctx: Context, amount: number, pid: string, operation: PaymentIntentCreateShape['operation']) => {
        if (operation.type === 'deposit') {
            if (!operation.txid) {
                throw Error('Transaction ID is missing');
            }

            // Change payment status
            await this.wallet.depositAsyncActionNeeded(ctx, operation.uid, operation.txid);
        } else {
            throw Error('Unknown operation type');
        }
    }

    routeCanceledPayment = async (ctx: Context, amount: number, pid: string, operation: PaymentIntentCreateShape['operation']) => { 
        if (operation.type === 'deposit') {
            if (!operation.txid) {
                throw Error('Transaction ID is missing');
            }

            // Confirm existing transaction
            await this.wallet.depositAsyncCommit(ctx, operation.uid, operation.txid);
        } else {
            throw Error('Unknown operation type');
        }
    }

    //
    // On-Session Payment Intents
    //

    routeSuccessfulPaymentIntent = async (ctx: Context, amount: number, operation: PaymentIntentCreateShape['operation']) => {
        if (operation.type === 'deposit') {
            await this.wallet.depositInstant(ctx, operation.uid, amount);
        } else {
            throw Error('Unknown operation type');
        }
    }
}