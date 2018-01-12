import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('building_projects', 'extrasFacebookUrl',
        {type: sequelize.STRING, allowNull: true});
    await queryInterface.addColumn('building_projects', 'extrasInstagramUrl',
        {type: sequelize.STRING, allowNull: true});
}