import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addIndex('lots', ['cityId', 'lotId'], {
        indicesType: 'UNIQUE'
    });
}