import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';

export interface StateAttributes {
    id?: number;
    code?: string;
    name?: string;
}

export interface State extends sequelize.Instance<StateAttributes>, StateAttributes {
}

export const StateTable = connection.define<State, StateAttributes>('state', {
    id: {type: sequelize.INTEGER, primaryKey: true, autoIncrement: true},
    code: {type: sequelize.STRING, allowNull: false, unique: true},
    name: {type: sequelize.STRING, allowNull: false},
});