import { QueryInterface, DataTypes, QueryOptions } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {

    let indexes = {
        uniqueKeys: {
            key: {
                fields: ['accountId', 'userId']
            }
        }
    } as QueryOptions;

    await queryInterface.createTable('account_members', {
        accountId: {
            type: dataTypes.INTEGER, references: {
                model: 'accounts',
                key: 'id',
            }
        },
        userId: {
            type: dataTypes.INTEGER, references: {
                model: 'users',
                key: 'id',
            }
        },
        owner: {type: dataTypes.BOOLEAN, defaultValue: false},
        activated: {type: dataTypes.BOOLEAN, defaultValue: false},
        createdAt: {type: dataTypes.DATE},
        updatedAt: {type: dataTypes.DATE}
    }, indexes);
}