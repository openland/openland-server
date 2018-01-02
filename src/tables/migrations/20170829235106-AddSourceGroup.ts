import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.addColumn('datasets', 'group', {type: dataTypes.STRING, allowNull: true});
}