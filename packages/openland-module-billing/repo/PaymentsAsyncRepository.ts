import { createLogger } from '@openland/log';
import { inTx } from '@openland/foundationdb';
import { Context } from '@openland/context';
import { Store, PaymentIntentCreateShape } from './../../openland-module-db/store';
import { RoutingRepository } from './RoutingRepository';

const log = createLogger('payments-async');

export class PaymentsAsyncRepository {
    readonly store: Store;
    private routing!: RoutingRepository;

    constructor(store: Store) {
        this.store = store;
    }

    setRouting = (routing: RoutingRepository) => {
        this.routing = routing;
    }

    createPayment = async (parent: Context, pid: string, uid: number, amount: number, operation: PaymentIntentCreateShape['operation']) => {
        return await inTx(parent, async (ctx) => {
            return await this.store.Payment.create(ctx, pid, {
                uid: uid,
                amount: amount,
                state: 'pending',
                operation: operation
            });
        });
    }

    findAllPending = async (parent: Context) => {
        return await this.store.Payment.pending.findAll(parent);
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
            if (this.routing.routeSuccessfulPayment) {
                await this.routing.routeSuccessfulPayment(ctx, payment.amount, payment.id, payment.operation);
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
            if (this.routing.routeCanceledPayment) {
                await this.routing.routeCanceledPayment(ctx, payment.amount, payment.id, payment.operation);
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
            if (this.routing.routeFailingPayment) {
                await this.routing.routeFailingPayment(ctx, payment.amount, payment.id, payment.operation);
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
            if (this.routing.routeActionNeededPayment) {
                await this.routing.routeActionNeededPayment(ctx, payment.amount, payment.id, payment.operation);
            }
        });
    }
}