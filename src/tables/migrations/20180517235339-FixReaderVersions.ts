import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('reader_states', 'version', { type: sequelize.INTEGER, defaultValue: 0 });
}