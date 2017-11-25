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