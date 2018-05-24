import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('folder_items', 'deletedAt', { type: sequelize.DATE });
    await queryInterface.removeIndex('folder_items', ['lotId', 'organizationId']);
    await queryInterface.removeIndex('folder_items', ['lotId', 'folderId']);
    await queryInterface.addIndex('folder_items', ['lotId', 'organizationId'], { indicesType: 'UNIQUE', where: { 'deletedAt': null as any } });
    await queryInterface.addIndex('folder_items', ['lotId', 'folderId'], { indicesType: 'UNIQUE', where: { 'deletedAt': null as any } });
}