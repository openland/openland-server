import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { JsonMap } from '../utils/json';

export interface AuthAuditAttributes {
    id?: number;
    ip?: string;
    method?: string;
    request?: string;
    response?: string;
    extras?: JsonMap;
}

export interface AuthAudit extends sequelize.Instance<AuthAuditAttributes>, AuthAuditAttributes {
}

export const AuthAuditTable = connection.define<AuthAudit, AuthAuditAttributes>('auth_audits', {
    id: {type: sequelize.INTEGER, primaryKey: true, autoIncrement: true},
    ip: { type: sequelize.STRING, allowNull: false },
    method: { type: sequelize.STRING, allowNull: false },
    request: { type: sequelize.STRING, allowNull: false },
    response: { type: sequelize.STRING, allowNull: false },
    extras: {
        type: sequelize.JSON,
        allowNull: false,
        defaultValue: {}
    },
});