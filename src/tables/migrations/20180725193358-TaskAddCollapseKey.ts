import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('tasks', 'collapseKey', { type: sequelize.STRING, allowNull: true });
}