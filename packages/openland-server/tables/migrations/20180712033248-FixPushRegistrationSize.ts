import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.changeColumn('user_push_registrations', 'pushEndpoint', { type: sequelize.STRING(4096), allowNull: false, unique: true });
}