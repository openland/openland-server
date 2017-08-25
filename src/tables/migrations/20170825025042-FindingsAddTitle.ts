import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.addColumn('findings', 'createdAt', { type: dataTypes.DATE })
    await queryInterface.addColumn('findings', 'updatedAt', { type: dataTypes.DATE })
    await queryInterface.addColumn('findings', 'title', { type: dataTypes.STRING, allowNull: false })
}

export async function down(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.removeColumn('findings', 'createdAt')
    await queryInterface.removeColumn('findings', 'updatedAt')
    await queryInterface.removeColumn('findings', 'title')
}