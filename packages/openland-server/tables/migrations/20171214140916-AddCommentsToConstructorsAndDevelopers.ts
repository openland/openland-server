import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('developers', 'comments', {type: sequelize.STRING(4096), allowNull: true});
    await queryInterface.addColumn('constructors', 'comments', {type: sequelize.STRING(4096), allowNull: true});
}