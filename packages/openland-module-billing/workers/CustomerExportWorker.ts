import { StripeMediator } from './../mediators/StripeMediator';
import { WorkQueue } from 'openland-module-workers/WorkQueue';

export function startCustomerExportWorker(queue: WorkQueue<{ uid: number }, { result: string }>, mediator: StripeMediator) {
    queue.addWorker(async (item, parent) => {
        await mediator.exportCustomer(parent, item.uid);
        return { result: 'ok' };
    });
}