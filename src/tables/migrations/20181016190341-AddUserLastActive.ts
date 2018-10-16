import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('users', 'lastActive', { type: sequelize.DATE, allowNull: true });
}