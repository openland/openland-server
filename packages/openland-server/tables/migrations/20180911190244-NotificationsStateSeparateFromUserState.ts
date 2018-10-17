import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('conversation_user_global_notifications', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        userId: {
            type: sequelize.INTEGER, allowNull: false, references: {
                model: 'users'
            }
        },
        lastPushNotification: { type: sequelize.DATE, allowNull: true },
        lastEmailSeq: { type: sequelize.INTEGER, defaultValue: 0, allowNull: false },
        lastPushSeq: { type: sequelize.INTEGER, defaultValue: 0, allowNull: false },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE }
    });
}