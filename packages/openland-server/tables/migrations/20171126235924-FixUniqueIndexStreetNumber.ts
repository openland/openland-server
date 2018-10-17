import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.removeIndex('street_numbers', 'streetnumbers_account_street_number_suffix');
    await queryInterface.addIndex('street_numbers', ['account', 'streetId', 'number'], {
        indicesType: 'UNIQUE',
        where: {
            'suffix': {
                $eq: null
            }
        }
    });
    await queryInterface.addIndex('street_numbers', ['account', 'streetId', 'number', 'suffix'], {
        indicesType: 'UNIQUE',
        where: {
            'suffix': {
                $ne: null
            }
        }
    });
}