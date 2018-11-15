import { forever, delay } from 'openland-utils/timer';
import { LockRepository } from 'openland-module-sync/LockRepository';
import { FDB } from 'openland-module-db/FDB';
import { inTx } from 'foundation-orm/inTx';
import { exponentialBackoffDelay } from 'openland-utils/exponentialBackoffDelay';
import { withLogContext } from 'openland-log/withLogContext';
import { serverRoleEnabled } from 'openland-utils/serverRoleEnabled';
import { createEmptyContext } from 'openland-utils/Context';

export class ModernScheduller {
    start = () => {
        if (serverRoleEnabled('workers')) {
            forever(async () => {
                await withLogContext('modern-scheduler', async () => {
                    let ctx = createEmptyContext();
                    
                    // Prerequisites
                    if (!(await LockRepository.tryLock(ctx, 'modern_work_scheduler', 1))) {
                        await delay(15000);
                        return;
                    }

                    //
                    // Timeout tasks in executing state
                    // If failureCount >= 5 then mark task as failed else mark as failing and increment failure count
                    // 
                    await inTx(async () => {
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
                    await inTx(async () => {
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

                    // Delay
                    await delay(10000);
                });
            });
        }
    }
}