import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.addColumn('streets', 'createdAt', dataTypes.DATE);
    await queryInterface.addColumn('streets', 'updatedAt', dataTypes.DATE);
}