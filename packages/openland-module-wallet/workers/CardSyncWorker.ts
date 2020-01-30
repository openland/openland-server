import { PaymentMediator } from '../mediators/PaymentMediator';
import { WorkQueue } from 'openland-module-workers/WorkQueue';

export function startCardSyncWorker(queue: WorkQueue<{ uid: number, pmid: string }, { result: string }>, mediator: PaymentMediator) {
    queue.addWorker(async (item, parent) => {
        await mediator.syncCard(parent, item.uid, item.pmid);
        return { result: 'ok' };
    });
}