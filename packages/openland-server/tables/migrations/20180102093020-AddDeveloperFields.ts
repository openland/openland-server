import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('developers', 'city', {type: sequelize.STRING(256)});
    await queryInterface.addColumn('developers', 'address', {type: sequelize.STRING(256)});
    await queryInterface.addColumn('developers', 'twitter', {type: sequelize.STRING(256)});
    await queryInterface.addColumn('developers', 'linkedin', {type: sequelize.STRING(256)});
    await queryInterface.addColumn('developers', 'facebook', {type: sequelize.STRING(256)});
}