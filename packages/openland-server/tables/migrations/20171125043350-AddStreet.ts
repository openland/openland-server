import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.createTable('streets', {
        id: {type: dataTypes.INTEGER, primaryKey: true, autoIncrement: true},
        account: {
            type: dataTypes.INTEGER, references: {
                model: 'accounts',
                key: 'id',
            }
        },
        name: {type: dataTypes.STRING, allowNull: false},
        suffix: {type: dataTypes.STRING, allowNull: true}
    });
    await queryInterface.addIndex('streets', ['account', 'name', 'suffix'], {
        indicesType: 'UNIQUE'
    });
}