import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('building_projects', 'extrasLatitude', {type: sequelize.DOUBLE, allowNull: true});
    await queryInterface.addColumn('building_projects', 'extrasLongitude', {type: sequelize.DOUBLE, allowNull: true});
}