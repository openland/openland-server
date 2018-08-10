import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('conversation_blocked_users', 'deletedAt', { type: sequelize.DATE });
}