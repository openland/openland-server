import { connection } from '../connector';
import * as sequelize from 'sequelize'
import { StreetTable, Street } from './Street';

export interface StreetNumberAttributes {
    id?: number;
    account?: number;
    street?: Street;
    streetId?: number;
    number?: number;
    suffix?: string;
}

export interface StreetNumber extends sequelize.Instance<StreetNumberAttributes>, StreetNumberAttributes { }

export const StreetNumberTable = connection.define<StreetNumber, StreetNumberAttributes>('street_number', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    account: {
        type: sequelize.INTEGER, references: {
            model: 'accounts',
            key: 'id',
        }
    },
    number: { type: sequelize.INTEGER, allowNull: false },
    suffix: { type: sequelize.STRING, allowNull: true },
}, {
        indexes: [{
            unique: true, fields: ['account', 'streetId', 'number'], where: {
                'suffix': {
                    $eq: null
                }
            }
        }, {
            unique: true, fields: ['account', 'streetId', 'number', 'suffix'], where: {
                'suffix': {
                    $neq: null
                }
            }
        }]
    })

StreetNumberTable.belongsTo(StreetTable, { as: 'street' })