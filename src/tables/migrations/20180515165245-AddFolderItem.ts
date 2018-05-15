import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('folder_items', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        organizationId: { type: sequelize.INTEGER, references: { model: 'organizations' }, allowNull: false },
        folderId: { type: sequelize.INTEGER, references: { model: 'folders' }, allowNull: false },
        lotId: { type: sequelize.INTEGER, references: { model: 'lots' }, allowNull: false },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE }
    });
    await queryInterface.addIndex('folder_items', ['lotId', 'organizationId'], { indicesType: 'UNIQUE' });
    await queryInterface.addIndex('folder_items', ['lotId', 'folderId'], { indicesType: 'UNIQUE' });
}