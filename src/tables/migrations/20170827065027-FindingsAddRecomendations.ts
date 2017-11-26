import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.addColumn('findings', 'recomendations', { type: dataTypes.STRING(65536), allowNull: true })
}

export async function down(queryInterface: QueryInterface, dataTypes: DataTypes) {
    
}