import { createLogger } from '@openland/log';
import { inTx } from '@openland/foundationdb';
import { StripeMediator } from './../mediators/StripeMediator';
import { Store } from 'openland-module-db/FDB';

const log = createLogger('payment-processor');

export function startPaymentProcessor(mediator: StripeMediator) {
    mediator.repo.paymentProcessorQueue.addWorker(async (item, parent) => {

        //
        // Load Payment
        //

        let payment = await inTx(parent, async (ctx) => {
            let res = await Store.Payment.findById(ctx, item.pid);
            if (!res) {
                throw Error('Unknown payment id ' + item.pid);
            }
            if (res.uid !== item.uid) {
                throw Error('Invalid payment uid');
            }
            return res;
        });

        //
        // Pick Default Card
        //

        let card = await inTx(parent, async (ctx) => {
            let cards = await Store.UserStripeCard.findAll(ctx);
            let dcard = await cards.find((v) => v.default);
            if (!dcard) {
                throw Error('Unable to find default card');
            }
            return dcard;
        });

        //
        // Perform Payment
        //

        try {
            await mediator.doOffSessionPayment(parent, item.uid, payment.amount, 'payment-' + item.uid + '-' + item.pid, card.pmid);
        } catch (err) {
            // Error code will be authentication_required if authentication is needed
            log.warn(parent, err);
            log.log(parent, 'Error code is: ', err.code);
            const paymentIntentRetrieved = await mediator.stripe.paymentIntents.retrieve(err.raw.payment_intent.id);
            log.log(parent, 'PI retrieved: ', paymentIntentRetrieved.id);
            throw err;
        }

        return { result: 'ok' };
    });
}