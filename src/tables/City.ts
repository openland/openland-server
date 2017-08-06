import { connection } from '../connector';
import * as sequelize from 'sequelize'

export interface CityAttributes {
    id?: number;
    name?: string;
}

export interface City extends sequelize.Instance<CityAttributes>, CityAttributes { }

export const CityTable = connection.define<City, CityAttributes>('city', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: sequelize.STRING },
})