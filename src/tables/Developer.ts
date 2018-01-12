import { connection } from '../connector';
import * as sequelize from 'sequelize';
import { BuildingProject } from './BuildingProject';

export interface DeveloperAttributes {
    id?: number;
    account?: number;
    title?: string;
    slug?: string;
    url?: string | null;
    logo?: string | null;
    cover?: string | null;
    city?: string | null;
    address?: string | null;
    twitter?: string | null;
    linkedin?: string | null;
    facebook?: string | null;
    isDeveloper?: boolean;
    isConstructor?: boolean;
    comments?: string | null;
}

export interface Developer extends sequelize.Instance<DeveloperAttributes>, DeveloperAttributes {
    developerProjects: Array<BuildingProject>;
    constructorProjects: Array<BuildingProject>;

    getDeveloperProjects(): Promise<Array<BuildingProject>>;

    getConstructorProjects(): Promise<Array<BuildingProject>>;
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
    url: {type: sequelize.STRING(256), allowNull: true, validate: {notEmpty: true}},
    logo: {type: sequelize.STRING(256), allowNull: true, validate: {notEmpty: true}},
    cover: {type: sequelize.STRING(256), allowNull: true, validate: {notEmpty: true}},
    city: {type: sequelize.STRING(256), allowNull: true, validate: {notEmpty: true}},
    address: {type: sequelize.STRING(256), allowNull: true, validate: {notEmpty: true}},
    twitter: {type: sequelize.STRING(256), allowNull: true, validate: {notEmpty: true}},
    linkedin: {type: sequelize.STRING(256), allowNull: true, validate: {notEmpty: true}},
    facebook: {type: sequelize.STRING(256), allowNull: true, validate: {notEmpty: true}},
    isDeveloper: {type: sequelize.BOOLEAN, allowNull: false, defaultValue: false},
    isConstructor: {type: sequelize.BOOLEAN, allowNull: false, defaultValue: false},
    comments: {type: sequelize.STRING(4096), allowNull: true, validate: {notEmpty: true}},
}, {indexes: [{unique: true, fields: ['slug', 'account']}]});