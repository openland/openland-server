import { createModernHyperlogger } from './createHyperlogEvent';
import { integer, string } from '../openland-module-clickhouse/schema';

export const taskCompletedLog = createModernHyperlogger('task_completed', {
    taskId: string(),
    taskType: string(),
    duration: integer(),
});

export const taskScheduledLog = createModernHyperlogger('task_scheduled', {
    taskId: string(),
    taskType: string(),
    duration: integer(),
});