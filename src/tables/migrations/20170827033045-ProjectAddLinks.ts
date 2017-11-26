import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.addColumn('projects', 'outputs', { type: dataTypes.STRING, allowNull: false, defaultValue: "[]" })
    await queryInterface.addColumn('projects', 'sources', { type: dataTypes.STRING, allowNull: false, defaultValue: "[]" })
}

export async function down(queryInterface: QueryInterface, dataTypes: DataTypes) {
    
}