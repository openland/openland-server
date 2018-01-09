import { connection } from '../connector';
import * as sequelize from 'sequelize';

export interface LockAttributes {
    id?: number;
    key?: string;
    seed?: string;
    timeout?: string;
}

export interface Lock extends sequelize.Instance<LockAttributes>, LockAttributes {
}

export const LockTable = connection.define<Lock, LockAttributes>('lock', {
    id: {type: sequelize.INTEGER, primaryKey: true, autoIncrement: true},
    key: {type: sequelize.STRING, allowNull: false, unique: true},
    seed: {type: sequelize.STRING, allowNull: false},
    timeout: {type: sequelize.DATE, allowNull: false},
});