import { delay, forever } from 'openland-server/utils/timer';
import { DB, DB_SILENT } from 'openland-server/tables';
import sequelize from 'sequelize';
import { LockRepository } from 'openland-repositories/LockRepository';

const MaximumFailingNumber = 5;

export function startLegacyScheduller() {
    forever(async () => {
        let res = await DB.connection.transaction({ logging: DB_SILENT as any }, async (tx) => {

            // Prerequisites
            if (!(await LockRepository.tryLock('work_scheduler', 1))) {
                return false;
            }

            let processed = false;

            // Mark failed
            // Move to failed if 
            //      status is 'failing' AND taskFailureCount >= MaximumFailingNumber AND Not Locked
            let now = new Date();
            let failed = (await DB.Task.update({ taskStatus: 'failed' }, {
                where: {
                    taskStatus: 'failing',
                    taskFailureCount: {
                        $gte: MaximumFailingNumber
                    },
                    taskLockTimeout: {
                        $or: [null, { $lte: now }]
                    }
                },
                transaction: tx,
                logging: DB_SILENT
            }))[0];
            if (failed > 0) {
                console.warn('Failed ' + failed + ' tasks');
                processed = true;
            }

            // Retry failing
            // Move to pending if
            //      status is 'failing' AND taskFailureCount < MaximumFailingNumber AND (taskFailureTime < now OR taskFailureTime null) AND Not Locked
            let retried = (await DB.Task.update({ taskStatus: 'pending' }, {
                where: {
                    taskStatus: 'failing',
                    taskFailureCount: {
                        $lt: MaximumFailingNumber
                    },
                    taskFailureTime: {
                        $or: [null, { $lte: now }]
                    },
                    taskLockTimeout: {
                        $or: [null, { $lte: now }]
                    }
                },
                transaction: tx,
                logging: DB_SILENT
            }))[0];
            if (retried > 0) {
                console.warn('Retried ' + retried + ' tasks');
                processed = true;
            }

            // Timeouting stale tasks
            // Move to failing if
            //      status is 'executing' AND Not Locked
            let timeouted = (await DB.Task.update({
                taskStatus: 'failing',
                taskFailureCount: sequelize.literal('"taskFailureCount" + 1') as any,
                taskFailureTime: new Date(Date.now() + 1000)
            }, {
                    where: {
                        taskStatus: 'executing',
                        taskLockTimeout: {
                            $or: [null, { $lte: now }]
                        },
                    },
                    transaction: tx,
                    logging: DB_SILENT
                }))[0];
            if (timeouted > 0) {
                console.warn('Timeouted ' + timeouted + ' tasks');
                processed = true;
            }

            return processed;
        });
        if (res) {
            await delay(100);
        } else {
            await delay(10000);
        }
    });
}
