import { connection } from '../connector';
import * as sequelize from 'sequelize';

export interface ConstructionProjectAttributes {
    id?: number;
    account?: number;
    projectId: string;
}

export interface ConstructionProject extends sequelize.Instance<ConstructionProjectAttributes>, ConstructionProjectAttributes {

}

export const BuildingProjectTable = connection.define<ConstructionProject, ConstructionProjectAttributes>('constrution_project', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    account: {
        type: sequelize.INTEGER, references: {
            model: 'accounts',
            key: 'id',
        },
        allowNull: false
    },
    projectId: { type: sequelize.STRING, allowNull: false },
}, { indexes: [{ unique: true, fields: ['projectId', 'account'] }] });