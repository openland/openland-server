import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('reader_states', 'remaining', { type: sequelize.STRING, allowNull: false, defaultValue: 0 });
}