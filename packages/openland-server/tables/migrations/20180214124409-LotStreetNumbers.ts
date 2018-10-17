import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('lot_street_numbers', {
        id: {
            type: sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        lotId: {
            type: sequelize.INTEGER,
            references: {
                model: 'lots',
                key: 'id'
            },
            allowNull: false
        },
        streetNumberId: {
            type: sequelize.INTEGER,
            references: {
                model: 'street_numbers',
                key: 'id'
            },
            allowNull: false
        },
        createdAt: sequelize.DATE,
        updatedAt: sequelize.DATE,
    });
}