import { connection } from '../connector';
import * as sequelize from 'sequelize'
import { PermitTable, Permit } from './Permit';
import { DeveloperTable, Developer } from './Developer';

export interface BuildingProjectAttributes {
    id?: number;
    account?: number;
    projectId: string;
    govId?: string;
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

    picture?: string;

    extrasDeveloper?: string | null;
    extrasGeneralConstructor?: string | null;
    extrasYearEnd?: string | null;
    extrasAddress?: string | null;
    extrasAddressSecondary?: string | null;
    extrasPermit?: string | null;
    extrasComment?: string | null;
    extrasUrl?: string | null;
    extrasLatitude?: number;
    extrasLongitude?: number;

    permits?: Array<Permit>;
    developers?: Array<Developer>;
}

export interface BuildingProject extends sequelize.Instance<BuildingProjectAttributes>, BuildingProjectAttributes {
    getPermits(): Promise<Array<Permit>>;
    setPermits(streets: Array<Permit>): Promise<void>;
    addPermits(id: number): Promise<Permit>;

    getDevelopers(): Promise<Array<Developer>>;
    setDevelopers(developers: Array<Developer>, args?: any): Promise<void>;
    addDevelopers(id: number): Promise<Developer>;
}

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
    govId: { type: sequelize.STRING, allowNull: true },
    name: { type: sequelize.STRING, allowNull: false },
    description: { type: sequelize.STRING, allowNull: true },
    status: { type: sequelize.ENUM("starting", "in_progress", "completed"), allowNull: false, defaultValue: "starting" },
    verified: { type: sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    picture: { type: sequelize.STRING, allowNull: false },

    projectStartedAt: { type: sequelize.DATEONLY, allowNull: true },
    projectCompletedAt: { type: sequelize.DATEONLY, allowNull: true },
    projectExpectedCompletedAt: { type: sequelize.DATEONLY, allowNull: true },

    existingUnits: { type: sequelize.INTEGER, allowNull: true },
    proposedUnits: { type: sequelize.INTEGER, allowNull: true },
    existingAffordableUnits: { type: sequelize.INTEGER, allowNull: true },
    proposedAffordableUnits: { type: sequelize.INTEGER, allowNull: true },

    extrasDeveloper: { type: sequelize.STRING, allowNull: true },
    extrasGeneralConstructor: { type: sequelize.STRING, allowNull: true },
    extrasYearEnd: { type: sequelize.STRING, allowNull: true },
    extrasAddress: { type: sequelize.STRING, allowNull: true },
    extrasAddressSecondary: { type: sequelize.STRING, allowNull: true },
    extrasPermit: { type: sequelize.STRING, allowNull: true },
    extrasComment: { type: sequelize.STRING, allowNull: true },
    extrasUrl: { type: sequelize.STRING, allowNull: true },

    extrasLatitude: { type: sequelize.DOUBLE, allowNull: true },
    extrasLongitude: { type: sequelize.DOUBLE, allowNull: true },

}, { indexes: [{ unique: true, fields: ['projectId', 'account'] }, { unique: true, fields: ['govId', 'account'] }] })

BuildingProjectTable.belongsToMany(PermitTable, { through: 'permit_building_projects', as: 'permits' })
PermitTable.belongsToMany(BuildingProjectTable, { through: 'permit_building_projects', as: 'buildingProjects' })

BuildingProjectTable.belongsToMany(DeveloperTable, { through: 'building_project_developers', as: 'developers' })
DeveloperTable.belongsToMany(BuildingProjectTable, { through: 'building_project_developers', as: 'buildingProjects' })