import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('conversation_group_members', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        userId: {
            type: sequelize.INTEGER, allowNull: false, references: {
                model: 'users'
            }
        },
        invitedById: {
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
    await queryInterface.addIndex('conversation_group_members', ['userId', 'conversationId'], { indicesType: 'UNIQUE' });
}