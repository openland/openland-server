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
    getOrganization(options?: any): Promise<Organization | null>;
}

export const FolderTable = connection.define<Folder, FolderAttributes>('folder', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: sequelize.STRING, allowNull: false }
});

FolderTable.belongsTo(OrganizationTable, { as: 'organization', foreignKey: { allowNull: false } });
