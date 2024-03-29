import { StripeEventCreated } from '../../openland-module-db/store';
import { batch } from '../../openland-utils/batch';
import { createLogger } from '@openland/log';
import { PaymentMediator } from '../mediators/PaymentMediator';
import { Store } from '../../openland-module-db/FDB';
import { singletonWorker } from '@openland/foundationdb-singleton';
import Stripe from 'stripe';
import { inReadOnlyTx, inTx } from '@openland/foundationdb';

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

export function startEventsReaderWorker(mediator: PaymentMediator) {
    const log = createLogger('events');
    singletonWorker({ db: Store.storage.db, name: 'stripe-events', delay: 1000 }, async (parent) => {

        //
        // Resolve Cursor
        //

        const cursorId = (mediator.liveMode ? 'live' : 'test') + '-v2';
        let cursor = await inReadOnlyTx(parent, async ctx => {
            let cursorRecord = await Store.StripeEventsCursor.findById(ctx, cursorId);
            return  cursorRecord ? cursorRecord.cursor : undefined;
        });

        //
        // Loading all events between now and cursor and sort backwards
        //
        let batchEvents: Stripe.Event[] = [];
        let events = await mediator.stripe.events.list({
            ending_before: cursor,
            limit: 100
        });
        for (let e of events.data) {
            batchEvents.unshift(e);
        }
        while (events.has_more) {
            let innerOffset = events.data[events.data.length - 1].id;
            events = await mediator.stripe.events.list({
                starting_after: innerOffset,
                limit: 100
            });
            for (let e of events.data) {
                batchEvents.unshift(e);
            }
        }

        // Persist Events
        if (batchEvents.length > 0) {
            log.debug(parent, 'Received new events');
            for (let e of batchEvents) {
                if (e.livemode !== mediator.liveMode) {
                    throw Error('Invalid live mode');
                }
                log.debug(parent, 'Event: ' + e.id);
            }
            for (let e of batch(batchEvents, 20)) {
                await inTx(parent, async (ctx) => {
                    for (let e1 of e) {
                        let ex = await Store.StripeEvent.findById(ctx, e1.id);
                        if (!ex) {
                            await Store.StripeEvent.create(ctx, e1.id, {
                                type: e1.type, data: e1.data, liveMode: e1.livemode, date: e1.created
                            });
                            Store.StripeEventStore.post(ctx, e1.livemode, StripeEventCreated.create({ id: e1.id, eventType: e1.type, eventDate: e1.created }));
                        }
                    }
                });
            }
        }

        // Update Offset
        if (batchEvents.length > 0) {
            await inTx(parent, async (ctx) => {
                let cr = batchEvents[batchEvents.length - 1].id;
                let ex = await Store.StripeEventsCursor.findById(ctx, cursorId);
                if (!ex) {
                    await Store.StripeEventsCursor.create(ctx, cursorId, { cursor: cr });
                } else {
                    ex.cursor = cr;
                }
            });
        }
    });
}
