import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';

export interface AccountAttributes {
    id?: number;
    name?: string;
    slug?: string;
    activated?: boolean;
    city?: string;
    generation?: number;
}

export interface Account extends sequelize.Instance<AccountAttributes>, AccountAttributes {
}

export const AccountTable = connection.define<Account, AccountAttributes>('account', {
    id: {type: sequelize.INTEGER, primaryKey: true, autoIncrement: true},
    name: {type: sequelize.STRING},
    slug: {type: sequelize.STRING, unique: true},
    activated: {type: sequelize.BOOLEAN, defaultValue: false},
    city: {type: sequelize.STRING, allowNull: true},
    generation: {type: sequelize.INTEGER, allowNull: false, defaultValue: 2}
});

export interface AccountMemberAttributes {
    accountId?: number;
    userId?: number;
    owner?: boolean;
}

export interface AccountMember extends sequelize.Instance<AccountMemberAttributes>, AccountMemberAttributes {
}

export const AccountMemberTable = connection.define<AccountMember, AccountMemberAttributes>('account_members', {
    id: {type: sequelize.INTEGER, primaryKey: true, autoIncrement: true},
    accountId: {
        type: sequelize.INTEGER, references: {
            model: 'account',
            key: 'id',
        }
    },
    userId: {
        type: sequelize.INTEGER, references: {
            model: 'user',
            key: 'id',
        }
    },
    owner: {type: sequelize.BOOLEAN, defaultValue: false}
}, {indexes: [{unique: true, fields: ['userId', 'accountId']}]});