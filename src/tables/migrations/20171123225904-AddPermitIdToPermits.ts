import { QueryInterface, DataTypes, QueryOptions } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.addColumn('permits', 'permitId', { type: dataTypes.STRING })
    let indexes = {
        unique: true
    } as QueryOptions
    await queryInterface.addIndex('permits', ['permitId', 'account'], indexes)
}

export async function down(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.removeColumn('permits', 'permitId')
}