import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';

export interface HitAttributes {
    id?: number;
    category?: string;
    tag?: string;
    hitsCount: number;
}

export interface Hit extends sequelize.Instance<HitAttributes>, HitAttributes {

}

export const HitsTable = connection.define<Hit, HitAttributes>('hits', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    category: { type: sequelize.STRING, allowNull: false },
    tag: { type: sequelize.STRING, allowNull: false },
    hitsCount: { type: sequelize.STRING, allowNull: false },
    createdAt: { type: sequelize.DATE },
    updatedAt: { type: sequelize.DATE },
}, { });
