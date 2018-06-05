import { connection } from '../connector';
import * as sequelize from 'sequelize';
import { OrganizationTable } from './Organization';

export interface UserAttributes {
    id?: number;
    authId?: string;
    email?: string;
}

export interface User extends sequelize.Instance<UserAttributes>, UserAttributes {
    
}

export const UserTable = connection.define<User, UserAttributes>('user', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    authId: { type: sequelize.STRING, unique: true },
    email: { type: sequelize.STRING, allowNull: false },
});

UserTable.belongsTo(OrganizationTable, { as: 'organization' });