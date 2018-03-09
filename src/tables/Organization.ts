import { connection } from '../connector';
import * as sequelize from 'sequelize';

export interface OrganizationAttributes {
    id?: number;
    title?: string;
}

export interface Organization extends sequelize.Instance<OrganizationAttributes>, OrganizationAttributes {
}

export const OrganizationTable = connection.define<Organization, OrganizationAttributes>('organization', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    title: { type: sequelize.STRING, allowNull: true }
});