import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.addColumn('permits','permitStatusUpdated', { type: dataTypes.DATEONLY, allowNull: true })
}

export async function down(queryInterface: QueryInterface, dataTypes: DataTypes) {
    
}