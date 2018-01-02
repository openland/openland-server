import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.addColumn('permits', 'permitId', {type: dataTypes.STRING});
    await queryInterface.addIndex('permits', ['permitId', 'account'], {
        indicesType: 'UNIQUE'
    });
}