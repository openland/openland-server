import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { JsonMap } from '../utils/json';

export interface AuthSessionAttributes {
    id?: number;
    sessionSalt?: string;
    code?: string;
    codeExpires?: Date;
    extras?: JsonMap;
}

export interface AuthSession extends sequelize.Instance<AuthSessionAttributes>, AuthSessionAttributes {
}

export const AuthSessionTable = connection.define<AuthSession, AuthSessionAttributes>('auth_sessions', {
    id: {type: sequelize.INTEGER, primaryKey: true, autoIncrement: true},
    sessionSalt: { type: sequelize.STRING, allowNull: false, unique: true },
    code: { type: sequelize.STRING, allowNull: false },
    codeExpires: { type: sequelize.DATE, allowNull: false },
    extras: {
        type: sequelize.JSON,
        allowNull: false,
        defaultValue: {}
    },
});