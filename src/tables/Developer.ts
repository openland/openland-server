import { connection } from '../connector';
import * as sequelize from 'sequelize';
import { BuildingProject } from './BuildingProject';

export interface DeveloperAttributes {
    id?: number;
    account?: number;
    title?: string;
    slug?: string;
    url?: string;
    logo?: string | null;
    comments?: string | null;
}

export interface Developer extends sequelize.Instance<DeveloperAttributes>, DeveloperAttributes {
    buildingProjects: Array<BuildingProject>;

    getBuildingProjects(): Promise<Array<BuildingProject>>;

    getBuildingProjects(developers: Array<BuildingProject>, args?: any): Promise<void>;
}

export const DeveloperTable = connection.define<Developer, DeveloperAttributes>('developer', {
    id: {type: sequelize.INTEGER, primaryKey: true, autoIncrement: true},
    account: {
        type: sequelize.INTEGER,
        references: {
            model: 'accounts',
            key: 'id',
        }
    },
    title: {
        type: sequelize.STRING(256), allowNull: false,
        validate: {
            notEmpty: true
        }
    },
    slug: {
        type: sequelize.STRING(256), allowNull: false,
        validate: {
            is: ['^[a-z]+$', 'i'],
        }
    },
    url: {type: sequelize.STRING(256), allowNull: true},
    logo: {type: sequelize.STRING(256), allowNull: true},
    comments: {type: sequelize.STRING(4096), allowNull: true},
}, {indexes: [{unique: true, fields: ['slug', 'account']}]});