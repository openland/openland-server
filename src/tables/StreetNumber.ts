import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { StreetTable, Street } from './Street';

export interface StreetNumberAttributes {
    id?: number;
    streetId?: number;
    number?: number;
    suffix?: string | null;
}

export interface StreetNumber extends sequelize.Instance<StreetNumberAttributes>, StreetNumberAttributes {
    street?: Street;
}

export const StreetNumberTable = connection.define<StreetNumber, StreetNumberAttributes>('street_number', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    number: { type: sequelize.INTEGER, allowNull: false },
    suffix: { type: sequelize.STRING, allowNull: true },
}, {
        indexes: [{
            unique: true, fields: ['streetId', 'number'], where: {
                'suffix': {
                    $eq: null
                }
            }
        }, {
            unique: true, fields: ['streetId', 'number', 'suffix'], where: {
                'suffix': {
                    $neq: null
                }
            }
        }]
    });

StreetNumberTable.belongsTo(StreetTable, { as: 'street' });