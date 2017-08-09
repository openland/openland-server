import { connection } from '../connector';
import * as sequelize from 'sequelize'

export interface DataSetAttributes {
    id?: number;
    name?: string;
    description?: string;
    segment?: number;
    kind?: DataSetKind;
    activated?: boolean;
    link?: string;
}

export enum DataSetKind {
    DataSet = 'dataset',
    Report = 'report'
}

export interface DataSet extends sequelize.Instance<DataSetAttributes>, DataSetAttributes { }

export const DataSetTable = connection.define<DataSet, DataSetAttributes>('datasets', {
    id: {
        type: sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    name: {
        type: sequelize.STRING,
        allowNull: false
    },
    description: {
        type: sequelize.STRING,
        allowNull: false
    },
    link: {
        type: sequelize.STRING,
        allowNull: false
    },
    segment: {
        type: sequelize.INTEGER,
        references: {
            model: 'segments',
            key: 'id',
        },
        allowNull: false
    },
    kind: {
        type: sequelize.ENUM(['dataset', 'report']),
        allowNull: false
    },
    activated: {
        type: sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
    }
})