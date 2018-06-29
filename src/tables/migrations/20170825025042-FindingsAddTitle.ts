import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.addColumn('findings', 'createdAt', {type: dataTypes.DATE});
    await queryInterface.addColumn('findings', 'updatedAt', {type: dataTypes.DATE});
    await queryInterface.addColumn('findings', 'title', {type: dataTypes.STRING, allowNull: false});
}