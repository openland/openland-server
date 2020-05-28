import { createModernHyperlogger } from './createHyperlogEvent';
import { integer, string } from '../openland-module-clickhouse/schema';

export default {
    TaskCompleted: createModernHyperlogger('task_completed', {
        taskId: string(),
        taskType: string(),
        duration: integer(),
    }),
    TaskScheduled: createModernHyperlogger('task_scheduled', {
        taskId: string(),
        taskType: string(),
        duration: integer(),
    })
};