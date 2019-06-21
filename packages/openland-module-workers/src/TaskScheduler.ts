import { FDB } from 'openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { exponentialBackoffDelay } from 'openland-utils/exponentialBackoffDelay';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { createNamedContext } from '@openland/context';
import { staticWorker } from 'openland-module-workers/staticWorker';

export class ModernScheduller {
    start = () => {
        if (serverRoleEnabled('workers')) {
            let root = createNamedContext('task-scheduler');
            staticWorker({ name: 'modern_work_scheduler' }, async () => {

                //
                // Timeout tasks in executing state
                // If failureCount >= 5 then mark task as failed else mark as failing and increment failure count
                // 
                await inTx(root, async (ctx) => {
                    let now = Date.now();
                    let failingTasks = await FDB.Task.rangeFromExecuting(ctx, 100);
                    for (let f of failingTasks) {
                        if ((f.taskLockTimeout === null || f.taskLockTimeout <= now)) {
                            if (f.taskFailureCount !== null && f.taskFailureCount >= 5) {
                                f.taskStatus = 'failed';
                            } else {
                                f.taskStatus = 'failing';
                                if (f.taskFailureCount === null) {
                                    f.taskFailureCount = 1;
                                } else {
                                    f.taskFailureCount++;
                                }
                                f.taskFailureTime = Date.now() + exponentialBackoffDelay(f.taskFailureCount!, 1000, 10000, 5);
                            }
                        }
                    }
                });

                //
                // Retry failing tasks
                ///
                await inTx(root, async (ctx) => {
                    let now = Date.now();
                    let failingTasks = await FDB.Task.rangeFromFailing(ctx, 100);
                    for (let f of failingTasks) {
                        if (f.taskFailureCount !== null && f.taskFailureCount >= 5) {
                            f.taskStatus = 'failed';
                        } else if (f.taskFailureTime && f.taskFailureTime < now) {
                            f.taskStatus = 'pending';
                        }
                    }
                });

                return false;
            });
        }
    }
}