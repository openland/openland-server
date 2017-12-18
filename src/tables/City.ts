import { connection } from '../connector';
import * as sequelize from 'sequelize'
import { CountyTable } from './County';

export interface CityAttributes {
    id?: number;
    countyId?: number;
    name?: string;
}
export interface City extends sequelize.Instance<CityAttributes>, CityAttributes { }

export const CityTable = connection.define<City, CityAttributes>('city', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: sequelize.STRING, allowNull: false },
}, { indexes: [{ unique: true, fields: ['countyId', 'name'] }] })

CityTable.belongsTo(CountyTable, { as: 'county' })