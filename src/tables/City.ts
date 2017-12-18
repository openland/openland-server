import { connection } from '../connector';
import * as sequelize from 'sequelize'

export interface CityAttributes {
    id?: number;
    account?: number;
    name?: string;
}
export interface City extends sequelize.Instance<CityAttributes>, CityAttributes { }

export const StreetTable = connection.define<City, CityAttributes>('city', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    account: {
        type: sequelize.INTEGER, references: {
            model: 'accounts',
            key: 'id',
        }
    },
    name: { type: sequelize.STRING, allowNull: false },
}, {
        indexes: [{
            unique: true, fields: ['account', 'name']
        }]
    })