import { connection } from '../connector';
import * as sequelize from 'sequelize'

export interface DataSourceAttributes {
    id?: number;
    account?: number;
    title?: string;
    key?: string;
}

export interface DataSource extends sequelize.Instance<DataSourceAttributes>, DataSourceAttributes { }

export const DataSourceTable = connection.define<DataSource, DataSourceAttributes>('data_source', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    account: {
        type: sequelize.INTEGER,
        references: {
            model: 'accounts',
            key: 'id',
        },
        unique: true
    },
    title: { type: sequelize.STRING(256), allowNull: false },
    key: { type: sequelize.STRING(256), allowNull: false, unique: true },
})