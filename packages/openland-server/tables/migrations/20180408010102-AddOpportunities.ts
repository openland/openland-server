import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('opportunities', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        organizationId: { type: sequelize.INTEGER, references: { model: 'organizations' }, allowNull: false },
        lotId: { type: sequelize.INTEGER, references: { model: 'lots' }, allowNull: false },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE }
    });
    await queryInterface.addIndex('opportunities', ['organizationId', 'lotId'], { indicesType: 'UNIQUE' });
}