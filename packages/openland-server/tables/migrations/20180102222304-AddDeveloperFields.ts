import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('developers', 'isDeveloper', {
        type: sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
    });
    await queryInterface.addColumn('developers', 'isConstructor', {
        type: sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
    });
}