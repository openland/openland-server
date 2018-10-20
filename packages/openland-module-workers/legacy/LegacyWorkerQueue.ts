import { LockState, DynamicLock } from 'openland-server/modules/dynamicLocking';
import { delay, forever, delayBreakable } from 'openland-server/utils/timer';
import { DB, DB_SILENT } from 'openland-server/tables';
import { JsonMap } from 'openland-server/utils/json';
import { Transaction } from 'sequelize';
import { exponentialBackoffDelay } from 'openland-server/utils/exponentialBackoffDelay';
import { Pubsub } from 'openland-server/modules/pubsub';
import UUID from 'uuid/v4';
import { LegacyTaskLocker } from './LegacyTaskLocker';
import { withLogDisabled } from 'openland-log/withLogDisabled';

const pubsub = new Pubsub<{ taskId: number }>();

export class LegacyWorkQueue<ARGS extends JsonMap, RES extends JsonMap> {
    private taskType: string;
    private locker = new DynamicLock({ lockTimeout: 10000, refreshInterval: 1000 });
    private pubSubTopic: string;

    constructor(taskType: string) {
        this.taskType = taskType;
        this.pubSubTopic = 'work_added' + this.taskType;
    }

    pushWork = async (work: ARGS, tx?: Transaction) => {
        let res = (await DB.Task.create({
            uid: UUID(),
            taskType: this.taskType,
            arguments: work
        }, { transaction: tx }));
        if (tx) {
            (tx as any).afterCommit(() => {
                // tslint:disable-next-line:no-floating-promises
                pubsub.publish(this.pubSubTopic, {
                    taskId: res.id
                });
            });
        } else {
            // tslint:disable-next-line:no-floating-promises
            pubsub.publish(this.pubSubTopic, {
                taskId: res.id
            });
        }

        return res;
    }

    addWorker = (handler: (item: ARGS, state: LockState, uid: string) => RES | Promise<RES>) => {
        let maxKnownWorkId = 0;
        let waiter: (() => void) | null = null;
        // tslint:disable-next-line:no-floating-promises
        pubsub.subscribe(this.pubSubTopic, (data) => {
            if (waiter) {
                if (maxKnownWorkId < data.taskId) {
                    maxKnownWorkId = data.taskId;
                    waiter();
                }
            }
        });
        withLogDisabled(() => {
            forever(async () => {
                let task = await DB.Task.find({
                    where: {
                        taskType: this.taskType,
                        taskStatus: 'pending'
                    },
                    order: [['id', 'asc']],
                    logging: DB_SILENT
                });
                if (task) {
                    console.warn('Task #' + task.id);
                    await this.locker.within(new LegacyTaskLocker(task.id), async (state) => {
                        // Switch status to executing
                        await task!!.reload({ logging: DB_SILENT });
                        state.check();
                        task!!.taskStatus = 'executing';
                        await task!!.save({ logging: DB_SILENT });

                        // Executing handler
                        let res: RES;
                        try {
                            res = await handler(task!!.arguments as ARGS, state, task!!.uid);
                        } catch (e) {
                            console.warn(e);

                            // Mark as failed
                            state.check();
                            let failureCount = (task!!.taskFailureCount || 0) + 1;
                            task!!.taskFailureTime = new Date(Date.now() + exponentialBackoffDelay(failureCount, 1000, 10000, 5));
                            task!!.taskFailureCount = (task!!.taskFailureCount || 0) + 1;
                            task!!.taskStatus = 'failing';
                            await task!!.save({ logging: DB_SILENT });
                            return;
                        }

                        // Mark as completed
                        state.check();
                        task!!.result = res;
                        task!!.taskStatus = 'completed';
                        await task!!.save({ logging: DB_SILENT });
                    });
                    await delay(100);
                } else {
                    let b = delayBreakable(10000);
                    waiter = b.resolver;
                    await b.promise;
                    waiter = null;
                }
            });
        });
    }
}