import { connection } from '../connector';
import * as sequelize from 'sequelize'

export interface CityAttributes {
    id?: number;
    name?: string;
    slug?: string;
    activated?: boolean;
}

export interface City extends sequelize.Instance<CityAttributes>, CityAttributes { }

export const CityTable = connection.define<City, CityAttributes>('account', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: sequelize.STRING },
    slug: { type: sequelize.STRING, unique: true },
    activated: { type: sequelize.BOOLEAN, defaultValue: false }
})