import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.removeIndex('streets', 'streets_account_name_suffix');
    await queryInterface.addIndex('streets', ['account', 'name'], {
        indicesType: 'UNIQUE',
        where: {
            'suffix': {
                $eq: null
            }
        }
    });
    await queryInterface.addIndex('streets', ['account', 'name', 'suffix'], {
        indicesType: 'UNIQUE',
        where: {
            'suffix': {
                $ne: null
            }
        }
    });
}