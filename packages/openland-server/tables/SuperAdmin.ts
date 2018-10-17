import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { UserTable, User } from './User';

export interface SuperAdminAttributes {
    id?: number;
    userId?: number | null;
    user?: User | null;
    role?: string | null;
}

export interface SuperAdmin extends sequelize.Instance<SuperAdminAttributes>, SuperAdminAttributes {
}

export const SuperAdminTable = connection.define<SuperAdmin, SuperAdminAttributes>('super_admin', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    role: { type: sequelize.STRING, allowNull: true }
});

SuperAdminTable.belongsTo(UserTable);