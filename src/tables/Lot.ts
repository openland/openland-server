import { connection } from '../connector';
import * as sequelize from 'sequelize';
import { Geometry } from '../modules/geometry';
import { Block, BlockTable } from './Block';
import { JsonMap } from '../utils/json';
import { CityTable } from './City';

export interface LotAttributes {
    id?: number;
    cityId?: number;
    lotId?: string;
    blockId?: number | null;
    geometry?: Geometry | null;
    extras?: JsonMap | null;
}

export interface Lot extends sequelize.Instance<LotAttributes>, LotAttributes {
    block?: Block;
}

export const LotTable = connection.define<Lot, LotAttributes>('lot', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    lotId: {
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
}, { indexes: [{ unique: true, fields: ['blockId', 'lotId'] }, { unique: true, fields: ['cityId', 'lotId'] }] });

LotTable.belongsTo(BlockTable, { as: 'block', foreignKey: { allowNull: false } });
LotTable.belongsTo(CityTable, { as: 'city' });