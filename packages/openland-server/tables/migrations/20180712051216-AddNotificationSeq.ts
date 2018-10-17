import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('conversation_user_globals', 'lastEmailSeq', { type: sequelize.INTEGER, defaultValue: 0, allowNull: false });
    await queryInterface.addColumn('conversation_user_globals', 'lastPushSeq', { type: sequelize.INTEGER, defaultValue: 0, allowNull: false });
}