import { connection } from '../connector';
import * as sequelize from 'sequelize';

export interface AirTableAttributes {
    id?: number;
    account: number;
    airtableKey: string;
    airtableDatabase: string;
}

export interface AirTable extends sequelize.Instance<AirTableAttributes>, AirTableAttributes {
}

export const AirTableTable = connection.define<AirTable, AirTableAttributes>('airtable', {
    id: {type: sequelize.INTEGER, primaryKey: true, autoIncrement: true},
    account: {
        type: sequelize.INTEGER, references: {
            model: 'accounts',
            key: 'id',
        },
        allowNull: false,
        unique: true
    },
    airtableKey: {type: sequelize.STRING, allowNull: false},
    airtableDatabase: {type: sequelize.STRING, allowNull: false}
});