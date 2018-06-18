import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.sequelize.query('TRUNCATE TABLE tasks;');
    await queryInterface.addColumn('tasks', 'uid', { type: sequelize.STRING, allowNull: false });
}