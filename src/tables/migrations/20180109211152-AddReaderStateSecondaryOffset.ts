import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('reader_states', 'currentOffsetSecondary', {
        type: sequelize.INTEGER,
        allowNull: true
    });
}