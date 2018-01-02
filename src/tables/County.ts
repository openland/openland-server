import { connection } from '../connector';
import * as sequelize from 'sequelize';
import { StateTable } from './State';

export interface CountyAttributes {
    id?: number;
    stateId?: number;
    code?: string;
    name?: string;
}

export interface County extends sequelize.Instance<CountyAttributes>, CountyAttributes {
}

export const CountyTable = connection.define<CountyAttributes, CountyAttributes>('county', {
    id: {type: sequelize.INTEGER, primaryKey: true, autoIncrement: true},
    name: {type: sequelize.STRING, allowNull: false},
}, {indexes: [{unique: true, fields: ['stateId', 'name']}]});

CountyTable.belongsTo(StateTable, {as: 'state'});