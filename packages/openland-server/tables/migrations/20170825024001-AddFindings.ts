import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, dataTypes: DataTypes) {
    await queryInterface.createTable('findings', {
        id: {type: dataTypes.INTEGER, primaryKey: true, autoIncrement: true},
        account: {
            type: dataTypes.INTEGER,
            references: {
                model: 'accounts',
                key: 'id',
            },
            unique: true
        },
        intro: {type: dataTypes.STRING, allowNull: false}
    });
}