import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.renameTable('streetnumbers', 'street_numbers')
    await queryInterface.renameColumn('permit_street_numbers', 'streetnumberId', 'streetNumberId')
}

export async function down(queryInterface: QueryInterface, dataTypes: DataTypes) {

}