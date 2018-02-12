import { connection } from '../connector';
import * as sequelize from 'sequelize';
import { Geometry } from '../modules/geometry';
import { CityTable, City } from './City';
import { JsonMap } from '../utils/json';

export interface BlockAttributes {
    id?: number;
    cityId?: number;
    blockId?: string;
    blockDisplayId?: string;
    geometry?: Geometry;
    extras?: JsonMap;
}

export interface Block extends sequelize.Instance<BlockAttributes>, BlockAttributes {
    city?: City;
}

export const BlockTable = connection.define<Block, BlockAttributes>('block', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    blockId: {
        type: sequelize.STRING,
        allowNull: false
    },
    geometry: {
        type: sequelize.JSON,
        allowNull: true
    },
    extras: {
        type: sequelize.JSON,
        allowNull: true
    }
}, { indexes: [{ unique: true, fields: ['cityId', 'blockId'] }] });

BlockTable.belongsTo(CityTable, { as: 'city' });