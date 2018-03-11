import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('super_admins', 'role', { type: sequelize.STRING, allowNull: true });
}