import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addIndex('permit_street_numbers', ['permitId']);
    await queryInterface.addIndex('permit_street_numbers', ['streetNumberId']);
    await queryInterface.addIndex('permit_events', ['permitId']);
}