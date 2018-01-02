import { connection } from '../connector';
import * as sequelize from 'sequelize';

export interface DataSetAttributes {
    id?: number;
    name?: string;
    description?: string;
    account?: number;
    kind?: string;
    activated?: boolean;
    link?: string;
    group?: string;
}

export interface DataSet extends sequelize.Instance<DataSetAttributes>, DataSetAttributes {
}

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
    account: {
        type: sequelize.INTEGER,
        references: {
            model: 'accounts',
            key: 'id',
        },
        allowNull: false
    },
    kind: {
        type: sequelize.ENUM(['dataset', 'document']),
        allowNull: false
    },
    activated: {
        type: sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    group: {
        type: sequelize.STRING,
        allowNull: true
    }
});