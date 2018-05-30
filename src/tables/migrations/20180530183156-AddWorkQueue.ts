import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('tasks', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        taskType: { type: sequelize.STRING, allowNull: false },
        arguments: { type: sequelize.JSON, allowNull: false },
        taskStatus: { type: sequelize.STRING, allowNull: false, defaultValue: 'pending' },
        taskFailureCount: { type: sequelize.INTEGER, allowNull: true },
        taskFailureTime: { type: sequelize.DATE, allowNull: true },
        taskLockSeed: { type: sequelize.STRING, allowNull: true },
        taskLockTimeout: { type: sequelize.DATE, allowNull: true },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE }
    });
}