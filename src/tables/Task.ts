import { connection } from '../connector';
import * as sequelize from 'sequelize';
import { JsonMap } from '../utils/json';

type TaskStatus = 'pending' | 'executing' | 'failing' | 'failed' | 'completed';

export interface TaskAttributes {
    id: number;
    taskType: string;
    arguments: JsonMap;
    result: JsonMap | null;

    taskStatus: TaskStatus;
    taskFailureCount: number | null;
    taskFailureTime: Date | null;
    taskLockSeed: string | null;
    taskLockTimeout: Date | null;
}

export interface Task extends sequelize.Instance<Partial<TaskAttributes>>, TaskAttributes {

}

export const TaskTable = connection.define<Task, Partial<TaskAttributes>>('task', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    taskType: { type: sequelize.STRING, allowNull: false },
    arguments: { type: sequelize.JSON, allowNull: false },
    result: { type: sequelize.JSON, allowNull: true },

    taskStatus: { type: sequelize.STRING, allowNull: false, defaultValue: 'pending' },

    taskFailureCount: { type: sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    taskFailureTime: { type: sequelize.DATE, allowNull: true },
    taskLockSeed: { type: sequelize.STRING, allowNull: true },
    taskLockTimeout: { type: sequelize.DATE, allowNull: true },
});