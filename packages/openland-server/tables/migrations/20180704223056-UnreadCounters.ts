import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    queryInterface.createTable('conversation_user_states', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        unread: { type: sequelize.INTEGER, defaultValue: 0, allowNull: false },
        readDate: { type: sequelize.INTEGER, defaultValue: 0, allowNull: true },
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
        updatedAt: { type: sequelize.DATE }
    });
}