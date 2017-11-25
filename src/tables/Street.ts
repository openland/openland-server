import { connection } from '../connector';
import * as sequelize from 'sequelize'

export interface StreetAttributes {
    id?: number;
    account?: number;
    name?: string;
    suffix?: string;
}
export interface Street extends sequelize.Instance<StreetAttributes>, StreetAttributes { }

export const StreetTable = connection.define<Street, StreetAttributes>('street', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    account: {
        type: sequelize.INTEGER, references: {
            model: 'accounts',
            key: 'id',
        }
    },
    name: { type: sequelize.STRING, allowNull: false },
    suffix: { type: sequelize.STRING, allowNull: true },
}, { indexes: [{ unique: true, fields: ['account', 'name', 'suffix'] }] })

export interface StreetNumberAttributes {
    id?: number;
    account?: number;
    number?: number;
    suffix?: number;
}

export interface BlockAttributes {
    id?: number;
    account?: number;
    number?: string;
}

export interface LotAttributes {
    id?: number;
    account?: number;
    block?: number;
    number?: string;
}