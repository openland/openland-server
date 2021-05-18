import { createLogger } from '@openland/log';
import { StripeEventCreated } from '../../openland-module-db/store';
import { Store } from '../../openland-module-db/FDB';
import { updateReader } from '../../openland-module-workers/updateReader';
import { PaymentMediator } from '../mediators/PaymentMediator';
import { inTx } from '@openland/foundationdb';

//
//
// 
//   /$$$$$$$   /$$$$$$        /$$   /$$  /$$$$$$  /$$$$$$$$       /$$$$$$$$ /$$$$$$  /$$   /$$  /$$$$$$  /$$   /$$
//   | $$__  $$ /$$__  $$      | $$$ | $$ /$$__  $$|__  $$__/      |__  $$__//$$__  $$| $$  | $$ /$$__  $$| $$  | $$
//   | $$  \ $$| $$  \ $$      | $$$$| $$| $$  \ $$   | $$            | $$  | $$  \ $$| $$  | $$| $$  \__/| $$  | $$
//   | $$  | $$| $$  | $$      | $$ $$ $$| $$  | $$   | $$            | $$  | $$  | $$| $$  | $$| $$      | $$$$$$$$
//   | $$  | $$| $$  | $$      | $$  $$$$| $$  | $$   | $$            | $$  | $$  | $$| $$  | $$| $$      | $$__  $$
//   | $$  | $$| $$  | $$      | $$\  $$$| $$  | $$   | $$            | $$  | $$  | $$| $$  | $$| $$    $$| $$  | $$
//   | $$$$$$$/|  $$$$$$/      | $$ \  $$|  $$$$$$/   | $$            | $$  |  $$$$$$/|  $$$$$$/|  $$$$$$/| $$  | $$
//  |_______/  \______/       |__/  \__/ \______/    |__/            |__/   \______/  \______/  \______/ |__/  |__/
//
//
//

export function startPaymentIntentCommiter(mediator: PaymentMediator) {

    const log = createLogger('commiter');

    updateReader('stripe-payment-intent-' + (mediator.liveMode ? 'live' : 'test'), 1, Store.StripeEventStore.createStream(mediator.liveMode, { batchSize: 10 }), async (args, parent) => {
        for (let i of args.items) {
            let e = (i as StripeEventCreated);
            if (e.eventType === 'payment_intent.succeeded' || e.eventType === 'payment_intent.canceled') {
                let eventData = await inTx(parent, async (ctx) => {
                    return (await Store.StripeEvent.findById(ctx, e.id))!.data;
                });
                let pid = eventData.object.id as string;

                if (e.eventType === 'payment_intent.succeeded') {
                    log.debug(parent, 'Commit Payment: ' + pid);
                } else if (e.eventType === 'payment_intent.canceled') {
                    log.debug(parent, 'Cancel Payment: ' + pid);
                }

                await mediator.updatePaymentIntent(parent, pid);
            }
        }
    });
}