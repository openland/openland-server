import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('conversation_messages', 'isMuted', { type: sequelize.BOOLEAN, allowNull: false, defaultValue: false });
    await queryInterface.addColumn('conversation_messages', 'isService', { type: sequelize.BOOLEAN, allowNull: false, defaultValue: false });
}