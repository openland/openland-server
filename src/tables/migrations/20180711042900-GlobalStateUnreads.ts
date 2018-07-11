import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('conversation_user_globals', 'hasUnnoticedUnread', { type: sequelize.BOOLEAN, defaultValue: false, allowNull: false });
    await queryInterface.addColumn('conversation_user_globals', 'lastEmailNotification', { type: sequelize.DATE, allowNull: true });
}