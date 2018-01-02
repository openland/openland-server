import { QueryInterface, DataTypes, QueryOptions } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.dropTable('account_members');
    let indexes = {
        uniqueKeys: {
            key: {
                fields: ['accountId', 'userId']
            }
        }
    } as QueryOptions;

    await queryInterface.createTable('account_members', {
        id: {type: dataTypes.INTEGER, primaryKey: true, autoIncrement: true},
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
        createdAt: {type: dataTypes.DATE},
        updatedAt: {type: dataTypes.DATE}
    }, indexes);
}