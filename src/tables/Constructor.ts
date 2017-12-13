import { connection } from '../connector';
import * as sequelize from 'sequelize'

export interface ConstructorAttributes {
    id?: number;
    account?: number;
    title?: string;
    slug?: string;
    url?: string;
    logo?: string;
}

export interface Constructor extends sequelize.Instance<ConstructorAttributes>, ConstructorAttributes { }

export const ConstructorTable = connection.define<Constructor, ConstructorAttributes>('constructor', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    account: {
        type: sequelize.INTEGER,
        references: {
            model: 'accounts',
            key: 'id',
        },
        unique: true
    },
    title: { type: sequelize.STRING(256), allowNull: false },
    slug: { type: sequelize.STRING(256), allowNull: false },
    url: { type: sequelize.STRING(256), allowNull: true },
    logo: { type: sequelize.STRING(256), allowNull: true },
}, { indexes: [{ unique: true, fields: ['slug', 'account'] }] })