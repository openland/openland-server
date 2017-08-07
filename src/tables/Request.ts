import { connection } from '../connector';
import * as sequelize from 'sequelize';

export interface RequestAttributes {
    id?: number;
    userId?: number;
    message?: string;
}

export interface Request extends sequelize.Instance<RequestAttributes>, RequestAttributes { }

export const RequestTable = connection.define<Request, RequestAttributes>('requests', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    userId: {
        type: sequelize.INTEGER, references: {
            model: 'users',
            key: 'id',
        }
    },
    message: {type: sequelize.STRING }
})