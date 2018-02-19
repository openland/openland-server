import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('lots', 'metadata', {
        type: sequelize.JSON,
        allowNull: false,
        defaultValue: {}
    });
}