import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('building_projects', 'createdAt', {type: sequelize.DATE});
    await queryInterface.addColumn('building_projects', 'updatedAt', {type: sequelize.DATE});
}