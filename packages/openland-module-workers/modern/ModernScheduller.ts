import { forever, delay } from 'openland-server/utils/timer';
import { LockRepository } from 'openland-repositories/LockRepository';
import { FDB } from 'openland-module-db/FDB';
import { inTx } from 'foundation-orm/inTx';

export class ModernScheduller {
    start = () => {
        forever(async () => {

            // Prerequisites
            if (!(await LockRepository.tryLock('modern_work_scheduler', 1))) {
                await delay(15000);
                return;
            }

            // Mark failed
            // Move to failed if 
            //      status is 'failing' AND taskFailureCount >= MaximumFailingNumber AND Not Locked
            let now = Date.now();
            await inTx(async () => {
                let failingTasks = await FDB.Task.rangeFromGlobalQueue('failing', 100);
                for (let f of failingTasks) {
                    if ((f.taskLockTimeout === null || f.taskLockTimeout <= now) && (f.taskFailureCount !== null && f.taskFailureCount >= 5)) {
                        f.taskStatus = 'failed';
                    }
                }
            });

            // Delay
            await delay(10000);
        });
    }
}