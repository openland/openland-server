import { createLogger } from '@openland/log';
import { Store } from '../../openland-module-db/FDB';
import { singletonWorker } from '@openland/foundationdb-singleton';
import { PaymentMediator } from '../mediators/PaymentMediator';
import { inTx } from '@openland/foundationdb';
import { WorkQueue } from 'openland-module-workers/WorkQueue';

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

export function startPaymentScheduler(mediator: PaymentMediator) {
    const log = createLogger('payments-scheduler');
    
    let queue = new WorkQueue<{ uid: number, pid: string, attempt: number }>('payment-executor-task', -1);
    queue.addWorker(async (item, parent) => {
        await inTx(parent, async (ctx) => {
            log.debug(parent, 'Executing: ' + item.pid);
            if (await mediator.tryExecutePayment(ctx, item.uid, item.pid)) {
                let sch = (await Store.PaymentScheduling.findById(ctx, item.pid))!;
                if (sch.attempt === item.attempt) {
                    sch.inProgress = false;
                    log.debug(parent, 'Success: ' + item.pid);
                }
            } else {
                let sch = (await Store.PaymentScheduling.findById(ctx, item.pid))!;
                if (sch.attempt === item.attempt) {
                    sch.failuresCount++;
                    sch.lastFailureDate = Date.now();
                    sch.inProgress = false;
                    log.debug(parent, 'Failure: ' + item.pid);
                }
            }
        });
    });

    singletonWorker({ db: Store.storage.db, name: 'payment-scheduler', delay: 1000 }, async (parent) => {
        let pending = await Store.Payment.pending.findAll(parent); // TODO: Optimize

        // log.debug(parent, 'Payments: ' + pending.length);

        for (let p of pending) {
            await inTx(parent, async (ctx) => {
                let sch = await Store.PaymentScheduling.findById(ctx, p.id);
                if (!sch) {
                    sch = await Store.PaymentScheduling.create(ctx, p.id, { attempt: 1, failuresCount: 0, inProgress: false });
                }

                if (!sch.inProgress) {
                    // Try to schedule

                    // Immediate scheduling before two failures
                    let shouldStart = false;
                    if (sch.failuresCount <= 2) {
                        shouldStart = true;
                    } else {
                        if (Date.now() - sch.lastFailureDate! > 60 * 60 * 1000 /* 1 hour */) {
                            shouldStart = true;
                        }
                    }

                    if (shouldStart) {
                        sch.attempt++;
                        sch.inProgress = true;
                        await queue.pushWork(ctx, { uid: p.uid, pid: p.id, attempt: sch.attempt });

                        log.debug(parent, 'Enqueue: ' + p.id);
                    }
                }
            });
        }
    });
}