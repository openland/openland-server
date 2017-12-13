import { connection } from '../connector';
import * as sequelize from 'sequelize'

export interface DeveloperAttributes {
    id?: number;
    account?: number;
    title?: string;
    slug?: string;
    url?: string;
    logo?: string;
}

export interface Developer extends sequelize.Instance<DeveloperAttributes>, DeveloperAttributes { }

export const DeveloperTable = connection.define<Developer, DeveloperAttributes>('developer', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    account: {
        type: sequelize.INTEGER,
        references: {
            model: 'accounts',
            key: 'id',
        }
    },
    title: { type: sequelize.STRING(256), allowNull: false },
    slug: { type: sequelize.STRING(256), allowNull: false },
    url: { type: sequelize.STRING(256), allowNull: true },
    logo: { type: sequelize.STRING(256), allowNull: true },
}, { indexes: [{ unique: true, fields: ['slug', 'account'] }] })