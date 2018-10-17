import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.changeColumn('conversation_user_globals', 'readSeq', { type: sequelize.INTEGER, allowNull: true });
}