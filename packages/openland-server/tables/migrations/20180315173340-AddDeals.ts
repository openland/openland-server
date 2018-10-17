import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('deals', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        title: { type: sequelize.STRING, allowNull: true },
        organizationId: { type: sequelize.INTEGER, references: { model: 'organizations' }, allowNull: false },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE }
    });
}