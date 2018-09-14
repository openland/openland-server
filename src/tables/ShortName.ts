import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';

export interface ShortNameAttributes {
    id?: number;
    name?: string;
    type?: string;
    ownerId?: number;
}

export interface ShortName extends sequelize.Instance<ShortNameAttributes>, ShortNameAttributes {
}

export const ShortNameTable = connection.define<ShortName, ShortNameAttributes>('short_name', {
    id: {type: sequelize.INTEGER, primaryKey: true, autoIncrement: true},
    name: {type: sequelize.STRING, allowNull: false, unique: true},
    type: {type: sequelize.STRING, allowNull: false},
    ownerId: {type: sequelize.INTEGER, allowNull: false},
});