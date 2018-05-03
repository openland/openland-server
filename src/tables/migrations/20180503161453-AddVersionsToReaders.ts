import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('locks', 'version', { type: sequelize.STRING, allowNull: false, defaultValue: 0 });
    await queryInterface.addColumn('locks', 'minVersion', { type: sequelize.STRING, allowNull: false, defaultValue: 0 });
}