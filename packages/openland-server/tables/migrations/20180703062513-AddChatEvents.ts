import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('conversation_events', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        eventType: { type: sequelize.STRING, allowNull: false },
        event: { type: sequelize.JSON, allowNull: false },
        seq: { type: sequelize.INTEGER, defaultValue: 0, allowNull: false },
        conversationId: {
            type: sequelize.INTEGER, allowNull: false, references: {
                model: 'conversations'
            }
        },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE },
        deletedAt: { type: sequelize.DATE }
    });
    await queryInterface.addColumn('conversations', 'seq', { type: sequelize.INTEGER, defaultValue: 0, allowNull: false });
}