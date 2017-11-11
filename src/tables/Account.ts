import { connection } from '../connector';
import * as sequelize from 'sequelize'

export interface AccountAttributes {
    id?: number;
    name?: string;
    slug?: string;
    activated?: boolean;
    city?: string;
}

export interface Account extends sequelize.Instance<AccountAttributes>, AccountAttributes { }

export const AccountTable = connection.define<Account, AccountAttributes>('account', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: sequelize.STRING },
    slug: { type: sequelize.STRING, unique: true },
    activated: { type: sequelize.BOOLEAN, defaultValue: false },
    city: { type: sequelize.STRING, allowNull: true },
})

export interface AccountMemberAttributes {
    accountId: number;
    userId: number;
    owner: boolean;
}

export interface AccountMember extends sequelize.Instance<AccountMemberAttributes>, AccountMemberAttributes { }

export const AccountMemberTable = connection.define<Account, AccountAttributes>('account_members', {
    accountId: {
        type: sequelize.INTEGER, references: {
            model: 'accounts',
            key: 'id',
        }
    },
    userId: {
        type: sequelize.INTEGER, references: {
            model: 'users',
            key: 'id',
        }
    },
    owner: { type: sequelize.BOOLEAN, defaultValue: false }
}, { indexes: [{ unique: true, fields: ['userId', 'accountId'] }] })