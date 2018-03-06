import { connection } from '../connector';
import * as sequelize from 'sequelize';

export interface SuperAdminAttributes {
    id?: number;
    userId?: number;
}

export interface SuperAdmin extends sequelize.Instance<SuperAdminAttributes>, SuperAdminAttributes {
}

export const SuperAdminTable = connection.define<SuperAdmin, SuperAdminAttributes>('super_admin', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    userId: {
        type: sequelize.INTEGER, references: {
            model: 'users',
            key: 'id'
        }
    }
});