import { connection } from '../modules/sequelizeConnector';
import * as sequelize from 'sequelize';
import { Organization, OrganizationTable } from './Organization';
import { FolderTable, Folder } from './Folder';
import { LotTable, Lot } from './Lot';

export interface FolderItemAttributes {
    id?: number;
    folderId?: number | null;
    folder?: Folder;
    organizationId?: number | null;
    organization?: Organization | null;
    lotId?: number | null;
    lot?: Lot | null;
}

export interface FolderItem extends sequelize.Instance<FolderItemAttributes>, FolderItemAttributes {
    deletedAt: Date | null;
    getOrganization(options?: any): Promise<Organization | null>;
    getFolder(options?: any): Promise<Folder | null>;
    getLot(options?: any): Promise<Lot | null>;
}

export const FolderItemTable = connection.define<FolderItem, FolderItemAttributes>('folder_item', {
    id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
}, { paranoid: true });

FolderItemTable.belongsTo(FolderTable, { as: 'folder', foreignKey: { allowNull: false } });
FolderItemTable.belongsTo(OrganizationTable, { as: 'organization', foreignKey: { allowNull: false } });
FolderItemTable.belongsTo(LotTable, { as: 'lot', foreignKey: { allowNull: false } });
