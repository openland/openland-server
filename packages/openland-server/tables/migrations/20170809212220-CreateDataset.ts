import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
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
        segment: {
            type: dataTypes.INTEGER,
            references: {
                model: 'segments',
                key: 'id',
            },
            allowNull: false
        },
        kind: {
            type: dataTypes.ENUM(['dataset', 'report']),
            allowNull: false
        },
        activated: {
            type: dataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false
        },
        createdAt: {type: dataTypes.DATE, allowNull: false},
        updatedAt: {type: dataTypes.DATE, allowNull: false}
    });
}