import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { ImageRef } from '../repositories/Media';
import { OrganizationExtras } from '../repositories/OrganizationExtras';
export interface OrganizationAttributes {
    id?: number;
    name?: string;
    status?: 'PENDING' | 'ACTIVATED' | 'SUSPENDED';
    website?: string | null;
    websiteTitle?: string | null;
    photo?: ImageRef | null;
    extras?: OrganizationExtras;
    userId?: number | null;
}

export interface Organization extends sequelize.Instance<OrganizationAttributes>, OrganizationAttributes {
}

export const OrganizationTable = connection.define<Organization, OrganizationAttributes>('organization', {
    id: {
        type: sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: sequelize.STRING,
        allowNull: true
    },
    status: {
        type: sequelize.ENUM(
            'PENDING',
            'ACTIVATED',
            'SUSPENDED'
        ),
        defaultValue: 'PENDING',
        allowNull: false
    },
    website: {
        type: sequelize.STRING,
        allowNull: true
    },
    photo: {
        type: sequelize.JSON,
        allowNull: true
    },
    extras: {
        type: sequelize.JSON,
        allowNull: false,
        defaultValue: {}
    },
    userId: {
        type: sequelize.INTEGER,
        allowNull: true,
        references: {
            model: 'user',
        }
    }
});