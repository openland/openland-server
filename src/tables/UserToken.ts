import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { User } from '.';
import { UserTable } from './User';

export interface UserTokenAttributes {
    id?: number;
    userId?: number | null;
    user?: User | null;
    tokenSalt?: string;
}

export interface UserToken extends sequelize.Instance<UserTokenAttributes>, UserTokenAttributes {
}

export const UserTokenTable = connection.define<UserToken, UserTokenAttributes>('user_token', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    tokenSalt: { type: sequelize.STRING, allowNull: false, unique: true },
});

UserTokenTable.belongsTo(UserTable, { foreignKey: { allowNull: false } });