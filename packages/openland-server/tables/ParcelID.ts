import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { CityTable } from './City';

export interface ParcelIDAttributes {
    id?: number;
    cityId?: number;
    parcelId?: string;
}

export interface ParcelID extends sequelize.Instance<ParcelIDAttributes>, ParcelIDAttributes {
}

export const ParcelIDTable = connection.define<ParcelID, ParcelIDAttributes>('parcel_id', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    parcelId: {
        type: sequelize.STRING,
        allowNull: false
    },
}, { indexes: [{ unique: true, fields: ['cityId', 'parcelId'] }] });
ParcelIDTable.belongsTo(CityTable, { as: 'city' });