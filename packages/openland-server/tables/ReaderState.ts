import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';

export interface ReaderStateAttributes {
    id?: number;
    key?: string;
    currentOffset?: Date | null;
    currentOffsetSecondary?: number | null;
    remaining?: number;
    version?: number;
}

export interface ReaderState extends sequelize.Instance<ReaderStateAttributes>, ReaderStateAttributes {
}

export const ReaderStateTable = connection.define<ReaderState, ReaderStateAttributes>('reader_state', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    key: { type: sequelize.STRING, allowNull: false, unique: true },
    currentOffset: { type: sequelize.DATE, allowNull: true },
    currentOffsetSecondary: { type: sequelize.INTEGER, allowNull: true },
    remaining: { type: sequelize.STRING, allowNull: false, defaultValue: 0 },
    version: { type: sequelize.INTEGER, allowNull: false, defaultValue: 0 }
});