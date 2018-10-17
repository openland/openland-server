import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.sequelize.query('TRUNCATE TABLE tasks;');
    await queryInterface.changeColumn('tasks', 'taskFailureCount', { type: sequelize.INTEGER, allowNull: false, defaultValue: 0 });
}