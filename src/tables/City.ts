import { connection } from '../connector';
import * as sequelize from 'sequelize'

export interface AccountAttributes {
    id?: number;
    name?: string;
    slug?: string;
    activated?: boolean;
}

export interface Account extends sequelize.Instance<AccountAttributes>, AccountAttributes { }

export const AccountTable = connection.define<Account, AccountAttributes>('account', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: sequelize.STRING },
    slug: { type: sequelize.STRING, unique: true },
    activated: { type: sequelize.BOOLEAN, defaultValue: false }
})