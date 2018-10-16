import * as sequelize from 'sequelize';
import { OrganizationTable } from './Organization';
import { Profile } from '../handlers/Profile';
import { connection } from '../modules/sequelizeConnector';
import { JsonMap } from '../utils/json';

export interface UserAttributes {
    id?: number;
    authId?: string;
    email?: string;
    isBot?: boolean;
    lastSeen?: Date | null;
    lastActive?: Date | null;
    status?: 'PENDING' | 'ACTIVATED' | 'SUSPENDED';
    profile?: Profile;
    invitedBy?: number;
    extras?: JsonMap;
}

export interface User extends sequelize.Instance<UserAttributes>, UserAttributes {

}

export const UserTable = connection.define<User, UserAttributes>('user', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    authId: { type: sequelize.STRING, unique: true },
    email: { type: sequelize.STRING, allowNull: false },
    isBot: { type: sequelize.BOOLEAN, allowNull: true, defaultValue: false },
    lastSeen: { type: sequelize.DATE, allowNull: true },
    lastActive: { type: sequelize.DATE, allowNull: true },
    status: {
        type: sequelize.ENUM(
            'PENDING',
            'ACTIVATED',
            'SUSPENDED'
        ),
        defaultValue: 'PENDING',
        allowNull: false
    },
    invitedBy: { type: sequelize.INTEGER, allowNull: true, references: { model: 'users' } },
    extras: {
        type: sequelize.JSON,
        allowNull: false,
        defaultValue: {}
    },
});

UserTable.belongsTo(OrganizationTable, { as: 'organization' });