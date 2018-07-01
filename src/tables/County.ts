import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { State, StateTable } from './State';

export interface CountyAttributes {
    id?: number;
    stateId?: number;
    name?: string;
}

export interface County extends sequelize.Instance<CountyAttributes>, CountyAttributes {
    state?: State;
}

export const CountyTable = connection.define<County, CountyAttributes>('county', {
    id: {type: sequelize.INTEGER, primaryKey: true, autoIncrement: true},
    name: {type: sequelize.STRING, allowNull: false},
}, {indexes: [{unique: true, fields: ['stateId', 'name']}]});

CountyTable.belongsTo(StateTable, {as: 'state'});