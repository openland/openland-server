import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('parcel_likes', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        userId: {
            type: sequelize.INTEGER, references: { model: 'users', key: 'id', },
            allowNull: false
        },
        lotId: {
            type: sequelize.INTEGER, references: { model: 'lots', key: 'id', },
            allowNull: false
        },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE }
    });
    await queryInterface.addIndex('parcel_likes', ['userId', 'lotId'], {
        indicesType: 'UNIQUE'
    });
}