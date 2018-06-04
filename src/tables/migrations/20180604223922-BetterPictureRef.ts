import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.removeColumn('user_profiles', 'picture');
    await queryInterface.addColumn('user_profiles', 'picture', { type: sequelize.JSON, allowNull: true });
}