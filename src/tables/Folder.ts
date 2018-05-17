import { connection } from '../connector';
import * as sequelize from 'sequelize';
import { Organization, OrganizationTable } from './Organization';

export interface FolderAttributes {
    id?: number;

    name?: string;

    organizationId?: number | null;
    organization?: Organization | null;
}

export interface Folder extends sequelize.Instance<FolderAttributes>, FolderAttributes {
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
    getOrganization(options?: any): Promise<Organization | null>;
}

export const FolderTable = connection.define<Folder, FolderAttributes>('folder', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: sequelize.STRING, allowNull: false }
}, { paranoid: true });

FolderTable.belongsTo(OrganizationTable, { as: 'organization', foreignKey: { allowNull: false } });
