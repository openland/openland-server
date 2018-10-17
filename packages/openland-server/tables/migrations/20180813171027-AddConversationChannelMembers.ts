import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('conversation_channel_members', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        orgId: {
            type: sequelize.INTEGER, allowNull: false, references: {
                model: 'organizations'
            }
        },
        invitedByUser: {
            type: sequelize.INTEGER, allowNull: false, references: {
                model: 'users'
            }
        },
        invitedByOrg: {
            type: sequelize.INTEGER, allowNull: false, references: {
                model: 'organizations'
            }
        },
        conversationId: {
            type: sequelize.INTEGER, allowNull: false, references: {
                model: 'conversations'
            }
        },
        status: { type: sequelize.STRING, allowNull: true },
        role: { type: sequelize.STRING, allowNull: false, defaultValue: 'member' },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE }
    });
    await queryInterface.addIndex('conversation_channel_members', ['orgId', 'conversationId'], { indicesType: 'UNIQUE' });
}