import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.addColumn('permits', 'permitStatusUpdated', {type: dataTypes.DATEONLY, allowNull: true});
}