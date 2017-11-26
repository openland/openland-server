import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {

    await queryInterface.dropTable('datasets')
    await queryInterface.createTable('datasets', {
        id: {
            type: dataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
        },
        name: {
            type: dataTypes.STRING,
            allowNull: false
        },
        description: {
            type: dataTypes.STRING,
            allowNull: false
        },
        link: {
            type: dataTypes.STRING,
            allowNull: false
        },
        account: {
            type: dataTypes.INTEGER,
            references: {
                model: 'accounts',
                key: 'id',
            },
            allowNull: false
        },
        kind: {
            type: dataTypes.STRING,
            allowNull: false
        },
        activated: {
            type: dataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false
        },
        createdAt: { type: dataTypes.DATE, allowNull: false },
        updatedAt: { type: dataTypes.DATE, allowNull: false }
    })
}

export async function down(queryInterface: QueryInterface, dataTypes: DataTypes) {
    
}