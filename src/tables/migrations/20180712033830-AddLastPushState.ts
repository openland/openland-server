import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('conversation_user_globals', 'lastPushNotification', { type: sequelize.DATE, allowNull: true });
}