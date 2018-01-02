import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.addColumn('projects', 'isPrivate',
        {type: dataTypes.BOOLEAN, allowNull: false, defaultValue: false});
}