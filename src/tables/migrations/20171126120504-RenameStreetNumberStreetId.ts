import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.renameColumn('street_numbers', 'street', 'streetId')
}

export async function down(queryInterface: QueryInterface, dataTypes: DataTypes) {

}