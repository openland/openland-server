import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('conversation_user_events', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        eventType: { type: sequelize.STRING, allowNull: false },
        event: { type: sequelize.JSON, allowNull: false },
        seq: { type: sequelize.INTEGER, allowNull: false },
        userId: {
            type: sequelize.INTEGER, allowNull: false, references: {
                model: 'users'
            }
        },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE }
    });
    await queryInterface.addColumn('conversation_user_globals', 'seq', { type: sequelize.INTEGER, defaultValue: 0, allowNull: false });
}