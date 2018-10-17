import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('user_profiles', 'phone', { type: sequelize.INTEGER, allowNull: true });
}