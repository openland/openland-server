import { StripeMediator } from './../mediators/StripeMediator';
import { WorkQueue } from 'openland-module-workers/WorkQueue';

export function startCardSyncWorker(queue: WorkQueue<{ uid: number, pmid: string }, { result: string }>, mediator: StripeMediator) {
    queue.addWorker(async (item, parent) => {
        await mediator.syncCard(parent, item.uid, item.pmid);
        return { result: 'ok' };
    });
}