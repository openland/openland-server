import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('conversation_messages', 'fileId', { type: sequelize.STRING, allowNull: true });
    await queryInterface.addColumn('conversation_messages', 'fileMetadata', { type: sequelize.JSON, allowNull: true });
    await queryInterface.changeColumn('conversation_messages', 'message', { type: sequelize.STRING(4096), allowNull: true });
}