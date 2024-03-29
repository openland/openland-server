import { PaymentMediator } from '../mediators/PaymentMediator';
import { WorkQueue } from 'openland-module-workers/WorkQueue';

export function startCustomerExportWorker(queue: WorkQueue<{ uid: number }>, mediator: PaymentMediator) {
    queue.addWorker(async (item, parent) => {
        await mediator.exportCustomer(parent, item.uid);
    });
}