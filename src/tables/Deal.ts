import { connection } from '../connector';
import * as sequelize from 'sequelize';
import { Organization, OrganizationTable } from './Organization';

export interface DealAttributes {
    id?: number;
    title?: string;

    organizationId?: number | null;
    organization?: Organization | null;
}

export interface Deal extends sequelize.Instance<DealAttributes>, DealAttributes {
}

export const DealTable = connection.define<Deal, DealAttributes>('deal', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: sequelize.STRING, allowNull: false }
});

DealTable.belongsTo(OrganizationTable, { as: 'organization', foreignKey: { allowNull: false } });