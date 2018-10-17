import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('conversations', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        title: {
            type: sequelize.STRING, allowNull: false
        },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE },
        deletedAt: { type: sequelize.DATE }
    });
    await queryInterface.createTable('conversation_messages', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        message: { type: sequelize.STRING, allowNull: false },
        userId: {
            type: sequelize.INTEGER, allowNull: false, references: {
                model: 'users'
            }
        },
        conversationId: {
            type: sequelize.INTEGER, allowNull: false, references: {
                model: 'conversations'
            }
        },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE },
        deletedAt: { type: sequelize.DATE }
    });
}