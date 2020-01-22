import { StripeMediator } from './../mediators/StripeMediator';
import { Store } from './../../openland-module-db/FDB';
import { singletonWorker } from '@openland/foundationdb-singleton';

const cursorId = 'test-v1';
export function startEventsReaderWorker(mediator: StripeMediator) {
    singletonWorker({ db: Store.storage.db, name: 'stripe-events', delay: 1000 }, async (parent) => {
        await mediator.pullEvents(parent, cursorId);
    });
}