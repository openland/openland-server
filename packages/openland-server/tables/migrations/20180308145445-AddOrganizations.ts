import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('organizations', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        title: { type: sequelize.STRING, allowNull: true },
        createdAt: sequelize.DATE,
        updatedAt: sequelize.DATE,
    });
    await queryInterface.addColumn('users', 'organizationId', { type: sequelize.INTEGER, references: { model: 'organizations' } });
}