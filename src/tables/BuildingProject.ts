import { connection } from '../connector';
import * as sequelize from 'sequelize'
import { PermitTable, Permit } from './Permit';

export interface BuildingProjectAttributes {
    id?: number;
    account?: number;
    projectId: string;
    name?: string;
    description?: string;
    verified?: boolean;
    status?: "starting" | "in_progress" | "completed"

    projectStartedAt?: string;
    projectCompletedAt?: string;
    projectExpectedCompletedAt?: string;

    existingUnits?: number;
    proposedUnits?: number;
    existingAffordableUnits?: number;
    proposedAffordableUnits?: number;

    airtableKey?: string;
    airtableTable?: string;

    permits?: Array<Permit>;
    getPermits?(): Promise<Array<Permit>>;
    setPermits?(streets: Array<Permit>): Promise<void>;
    addPermits?(id: number): Promise<Permit>;
}

export interface BuildingProject extends sequelize.Instance<BuildingProjectAttributes>, BuildingProjectAttributes { }

export const BuildingProjectTable = connection.define<BuildingProject, BuildingProjectAttributes>('building_project', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    account: {
        type: sequelize.INTEGER, references: {
            model: 'accounts',
            key: 'id',
        },
        allowNull: false
    },
    projectId: { type: sequelize.STRING, allowNull: false },
    name: { type: sequelize.STRING, allowNull: false },
    description: { type: sequelize.STRING, allowNull: true },
    status: { type: sequelize.ENUM("starting", "in_progress", "completed"), allowNull: false, defaultValue: "starting" },
    verified: { type: sequelize.BOOLEAN, allowNull: false, defaultValue: false },

    projectStartedAt: { type: sequelize.DATEONLY, allowNull: true },
    projectCompletedAt: { type: sequelize.DATEONLY, allowNull: true },
    projectExpectedCompletedAt: { type: sequelize.DATEONLY, allowNull: true },

    existingUnits: { type: sequelize.INTEGER, allowNull: true },
    proposedUnits: { type: sequelize.INTEGER, allowNull: true },
    existingAffordableUnits: { type: sequelize.INTEGER, allowNull: true },
    proposedAffordableUnits: { type: sequelize.INTEGER, allowNull: true },

}, { indexes: [{ unique: true, fields: ['projectId', 'account'] }] })

BuildingProjectTable.belongsToMany(PermitTable, { through: 'permit_building_projects', as: 'permits' })
PermitTable.belongsToMany(BuildingProjectTable, { through: 'permit_building_projects', as: 'buildingProjects' })