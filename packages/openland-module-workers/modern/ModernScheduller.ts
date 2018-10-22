import { forever, delay } from 'openland-server/utils/timer';
import { LockRepository } from 'openland-repositories/LockRepository';
import { FDB } from 'openland-module-db/FDB';
import { inTx } from 'foundation-orm/inTx';
import { exponentialBackoffDelay } from 'openland-server/utils/exponentialBackoffDelay';
import { withLogContext } from 'openland-log/withLogContext';

export class ModernScheduller {
    start = () => {
        forever(async () => {
            await withLogContext('modern-scheduler', async () => {

                // Prerequisites
                if (!(await LockRepository.tryLock('modern_work_scheduler', 1))) {
                    await delay(15000);
                    return;
                }

                //
                // Timeout tasks in executing state
                // If failureCount >= 5 then mark task as failed else mark as failing and increment failure count
                // 
                await inTx(async () => {
                    let now = Date.now();
                    let failingTasks = await FDB.Task.rangeFromExecuting(100);
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
                    let failingTasks = await FDB.Task.rangeFromFailing(100);
                    for (let f of failingTasks) {
                        if (f.taskFailureTime && f.taskFailureTime < now) {
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