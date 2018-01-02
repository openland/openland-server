import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('airtables', {
        id: {type: sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        account: {
            type: sequelize.INTEGER, references: {
                model: 'accounts',
                key: 'id',
            },
            allowNull: false,
            unique: true
        },
        airtableKey: {type: sequelize.STRING, allowNull: false},
        airtableDatabase: {type: sequelize.STRING, allowNull: false},

        createdAt: sequelize.DATE,
        updatedAt: sequelize.DATE,
    });
}