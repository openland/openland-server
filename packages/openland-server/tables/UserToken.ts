import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { User } from '.';
import { UserTable } from './User';

export interface UserTokenAttributes {
    id?: number;
    userId?: number | null;
    user?: User | null;
    tokenSalt?: string;
    lastIp?: string;
    uuid?: string;
}

export interface UserToken extends sequelize.Instance<UserTokenAttributes>, UserTokenAttributes {
}

export const UserTokenTable = connection.define<UserToken, UserTokenAttributes>('user_token', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    tokenSalt: { type: sequelize.STRING, allowNull: false, unique: true },
    lastIp: { type: sequelize.STRING, allowNull: true },
    uuid: { type: sequelize.STRING, allowNull: false, defaultValue: connection.literal('uuid_generate_v4()') },
});

UserTokenTable.belongsTo(UserTable, { foreignKey: { allowNull: false } });