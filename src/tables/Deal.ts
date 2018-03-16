import { connection } from '../connector';
import * as sequelize from 'sequelize';
import { Organization, OrganizationTable } from './Organization';

export interface DealAttributes {
    id?: number;
    title?: string;

    status?: string | null;
    statusDescription?: string | null;
    statusDate?: string | null;

    address?: string | null;
    location?: string | null;

    organizationId?: number | null;
    organization?: Organization | null;
}

export interface Deal extends sequelize.Instance<DealAttributes>, DealAttributes {
}

export const DealTable = connection.define<Deal, DealAttributes>('deal', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: sequelize.STRING, allowNull: false },

    status: { type: sequelize.STRING, allowNull: true },
    statusDescription: { type: sequelize.STRING, allowNull: true },
    statusDate: { type: sequelize.DATE, allowNull: true },

    address: { type: sequelize.STRING, allowNull: true },
    location: { type: sequelize.STRING, allowNull: true },
});

DealTable.belongsTo(OrganizationTable, { as: 'organization', foreignKey: { allowNull: false } });