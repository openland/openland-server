import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.changeColumn('user_profiles', 'website', { type: sequelize.STRING, allowNull: true });
    await queryInterface.changeColumn('user_profiles', 'about', { type: sequelize.STRING, allowNull: true });
    await queryInterface.changeColumn('user_profiles', 'location', { type: sequelize.STRING, allowNull: true });
}