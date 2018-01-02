import { connection } from '../connector';
import * as sequelize from 'sequelize';

export interface ConstructorAttributes {
    id?: number;
    account?: number;
    title?: string;
    slug?: string;
    url?: string;
    logo?: string;
    comments?: string;
}

export interface Constructor extends sequelize.Instance<ConstructorAttributes>, ConstructorAttributes {
}

export const ConstructorTable = connection.define<Constructor, ConstructorAttributes>('constructor', {
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