import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('user_profiles', 'email', { type: sequelize.STRING, allowNull: true });
}