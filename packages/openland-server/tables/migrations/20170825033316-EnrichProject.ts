import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.addColumn('projects', 'description', {type: dataTypes.STRING, allowNull: true});
    await queryInterface.addColumn('projects', 'findings', {type: dataTypes.STRING, allowNull: true});
}