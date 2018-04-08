import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('opportunities', 'state', { type: sequelize.STRING, allowNull: false, defaultValue: 'INCOMING' });
}