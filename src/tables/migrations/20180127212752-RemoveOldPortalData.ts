import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.dropTable('datasets');
    await queryInterface.dropTable('findings');
    await queryInterface.dropTable('projects');
}