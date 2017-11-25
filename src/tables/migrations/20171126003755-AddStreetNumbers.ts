import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.createTable('streetnumbers', {
        id: { type: dataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        account: {
            type: dataTypes.INTEGER, references: {
                model: 'accounts',
                key: 'id',
            }
        },
        street: {
            type: dataTypes.INTEGER, references: {
                model: 'streets',
                key: 'id',
            }
        },
        number: { type: dataTypes.INTEGER, allowNull: false },
        suffix: { type: dataTypes.STRING, allowNull: true },
        createdAt: { type: dataTypes.DATE },
        updatedAt: { type: dataTypes.DATE }
    })
    await queryInterface.addIndex('streetnumbers', ['account', 'street', 'number', 'suffix'], {
        indicesType: 'UNIQUE'
    })
}

export async function down(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.dropTable('streetnumbers')
}