import { Store } from '../../openland-module-db/FDB';
import { inTx } from '@openland/foundationdb';
import { exponentialBackoffDelay } from 'openland-utils/exponentialBackoffDelay';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { createNamedContext } from '@openland/context';
import { singletonWorker } from '@openland/foundationdb-singleton';

export class ModernScheduller {
    start = () => {
        if (serverRoleEnabled('admin')) {
            let root = createNamedContext('task-scheduler');
            singletonWorker({ db: Store.storage.db, name: 'modern_work_scheduler', delay: 1000 }, async () => {

                //
                // Timeout tasks in executing state
                // If failureCount >= 5 then mark task as failed else mark as failing and increment failure count
                // 
                await inTx(root, async (ctx) => {
                    let now = Date.now();
                    let failingTasks = (await Store.Task.executing.query(ctx, { limit: 100 })).items;
                    for (let f of failingTasks) {
                        if ((f.taskLockTimeout === null || f.taskLockTimeout <= now)) {
                            let maxFailureCount = 5;
                            if (f.taskMaxFailureCount !== null) {
                                maxFailureCount = f.taskMaxFailureCount;
                            }
                            if (f.taskFailureCount !== null && maxFailureCount >= 0 && f.taskFailureCount >= maxFailureCount) {
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
                    let failingTasks = (await Store.Task.failing.query(ctx, { limit: 100 })).items;
                    for (let f of failingTasks) {
                        let maxFailureCount = 5;
                        if (f.taskMaxFailureCount !== null) {
                            maxFailureCount = f.taskMaxFailureCount;
                        }
                        if (f.taskFailureCount !== null && maxFailureCount >= 0 && f.taskFailureCount >= maxFailureCount) {
                            f.taskStatus = 'failed';
                        } else if (f.taskFailureTime && f.taskFailureTime < now) {
                            f.taskStatus = 'pending';
                        }
                    }
                });
            });
        }
    }
}