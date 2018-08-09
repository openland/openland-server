import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('conversation_blocked', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        conversation: { type: sequelize.INTEGER, allowNull: false },
        user: { type: sequelize.INTEGER, allowNull: false },
        blockedBy: { type: sequelize.INTEGER, allowNull: false },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE },
    });
}