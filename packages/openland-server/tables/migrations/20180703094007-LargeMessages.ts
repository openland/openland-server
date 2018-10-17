import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.changeColumn('conversation_messages', 'message', { type: sequelize.STRING(4096), allowNull: false });
}