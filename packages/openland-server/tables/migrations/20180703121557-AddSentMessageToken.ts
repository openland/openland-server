import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('conversation_messages', 'repeatToken', { type: sequelize.STRING, allowNull: true, unique: true });
}