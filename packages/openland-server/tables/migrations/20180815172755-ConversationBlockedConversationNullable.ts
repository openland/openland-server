import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.changeColumn('conversation_blocked_users', 'conversation', { type: sequelize.INTEGER, allowNull: true });
}