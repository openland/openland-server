import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('folders', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: sequelize.STRING, allowNull: false },
        organizationId: { type: sequelize.INTEGER, references: { model: 'organizations' }, allowNull: false },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE }
    });
}