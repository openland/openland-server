import { PaymentCreateShape } from './../../openland-module-db/store';
import { createLogger } from '@openland/log';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { Store } from '../../openland-module-db/store';
import { RoutingRepository } from './RoutingRepository';

const log = createLogger('payments-async');

export class PaymentsRepository {
    readonly store: Store;
    private routing!: RoutingRepository;

    constructor(store: Store) {
        this.store = store;
    }

    setRouting = (routing: RoutingRepository) => {
        this.routing = routing;
    }

    createPayment = async (parent: Context, pid: string, uid: number, amount: number, operation: PaymentCreateShape['operation']) => {

        // Input Validation
        if (operation.type === 'deposit') {
            if (operation.uid !== uid) {
                throw Error('uid mismatch');
            }
        } else if (operation.type === 'subscription') {
            if (operation.uid !== uid) {
                throw Error('uid mismatch');
            }
        }

        // Create Payment
        return await inTx(parent, async (ctx) => {
            return await this.store.Payment.create(ctx, pid, {
                uid: uid,
                amount: amount,
                state: 'pending',
                operation: operation
            });
        });
    }

    //
    // Handle Payment State change
    //

    handlePaymentIntentSuccess = async (parent: Context, pid: string) => {
        log.debug(parent, 'Success');
        await inTx(parent, async (ctx) => {
            let payment = await this.store.Payment.findById(ctx, pid);
            if (!payment) {
                throw Error('Unable to find payment');
            }
            if (payment.state === 'success') {
                log.debug(parent, 'Success: double');
                return;
            }
            if (payment.state === 'canceled') {
                log.debug(parent, 'Success: Canceled');
                // Shouldn't be possible
                throw Error('Payment already canceled!');
            }
            payment.state = 'success';

            // Handle successful payment
            log.debug(parent, 'Success: Routing');
            if (this.routing.onPaymentSuccess) {
                await this.routing.onPaymentSuccess(ctx, payment.amount, payment.id, payment.operation);
            }
        });
    }

    handlePaymentIntentCanceled = async (parent: Context, pid: string) => {
        log.debug(parent, 'canceled');
        await inTx(parent, async (ctx) => {
            let payment = await this.store.Payment.findById(ctx, pid);
            if (!payment) {
                throw Error('Unable to find payment');
            }
            if (payment.state === 'success' || payment.state === 'canceled') {
                return;
            }
            payment.state = 'canceled';

            // Handle canceled payment
            if (this.routing.onPaymentCanceled) {
                await this.routing.onPaymentCanceled(ctx, payment.amount, payment.id, payment.operation);
            }
        });
    }

    handlePaymentFailing = async (parent: Context, pid: string) => {
        await inTx(parent, async (ctx) => {
            let payment = await this.store.Payment.findById(ctx, pid);
            if (!payment) {
                throw Error('Unable to find payment');
            }
            if (payment.state !== 'pending') {
                return;
            }
            payment.state = 'failing';

            // Handle failing state
            if (this.routing.onPaymentFailing) {
                await this.routing.onPaymentFailing(ctx, payment.amount, payment.id, payment.operation);
            }
        });
    }

    handlePaymentActionRequired = async (parent: Context, pid: string) => {
        await inTx(parent, async (ctx) => {
            let payment = await this.store.Payment.findById(ctx, pid);
            if (!payment) {
                throw Error('Unable to find payment');
            }
            if (payment.state !== 'pending' && payment.state !== 'failing') {
                return;
            }
            payment.state = 'action_required';

            // Handle action needed state
            if (this.routing.onPaymentActionNeeded) {
                await this.routing.onPaymentActionNeeded(ctx, payment.amount, payment.id, payment.operation);
            }
        });
    }
}