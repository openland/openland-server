import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('lots', 'retired', {
        type: sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
    });
}