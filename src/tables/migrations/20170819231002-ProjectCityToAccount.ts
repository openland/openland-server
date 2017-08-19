import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.renameColumn('projects', 'city', 'account')
}

export async function down(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.renameColumn('projects', 'account', 'city')
}