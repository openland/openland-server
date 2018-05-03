import { connection } from '../connector';
import * as sequelize from 'sequelize';

export interface ReaderStateAttributes {
    id?: number;
    key?: string;
    currentOffset?: string | null;
    currentOffsetSecondary?: number | null;
}

export interface ReaderState extends sequelize.Instance<ReaderStateAttributes>, ReaderStateAttributes {
}

export const ReaderStateTable = connection.define<ReaderState, ReaderStateAttributes>('reader_state', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    key: { type: sequelize.STRING, allowNull: false, unique: true },
    currentOffset: { type: sequelize.DATE, allowNull: true },
    currentOffsetSecondary: { type: sequelize.INTEGER, allowNull: true }
});