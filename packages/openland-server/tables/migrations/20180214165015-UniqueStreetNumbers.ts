import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addIndex('lot_street_numbers', ['lotId', 'streetNumberId'], {
        indicesType: 'UNIQUE'
    });
}