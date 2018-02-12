import { connection } from '../connector';
import * as sequelize from 'sequelize';
import { Geometry } from '../modules/geometry';
import { Block, BlockTable } from './Block';
import { JsonMap } from '../utils/json';

export interface LotAttributes {
    id?: number;
    blockId?: number;
    lotId?: string;
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
}, { indexes: [{ unique: true, fields: ['blockId', 'lotId'] }] });

LotTable.belongsTo(BlockTable, { as: 'block' });