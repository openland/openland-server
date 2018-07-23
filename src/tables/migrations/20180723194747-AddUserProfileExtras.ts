import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('user_profiles', 'extras', {
        type: sequelize.JSON,
        allowNull: false,
        defaultValue: {}
    });
}