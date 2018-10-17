import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { ListingExtras } from '../repositories/OrganizationExtras';
export interface OrganizationListingAttributes {
    id?: number;
    name?: string;
    type?: 'development_opportunity' | 'acquisition_request' | 'common';
    extras?: ListingExtras;
    orgId?: number;
    userId?: number;
}

export interface OrganizationListing extends sequelize.Instance<OrganizationListingAttributes>, OrganizationListingAttributes {
}

export const OrganizationListingTable = connection.define<OrganizationListing, OrganizationListingAttributes>('organization_listing', {
    id: {
        type: sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: sequelize.STRING,
        allowNull: false
    },
    type: {
        type: sequelize.STRING,
        allowNull: false
    },
    extras: {
        type: sequelize.JSON,
        allowNull: false,
        defaultValue: {}
    },
    userId: {
        type: sequelize.INTEGER,
        allowNull: false,
        references: {
            model: 'user',
        }
    },
    orgId: {
        type: sequelize.INTEGER,
        allowNull: false,
        references: {
            model: 'organization',
        }
    }
});