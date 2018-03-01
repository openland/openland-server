import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('parcel_ids', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        parcelId: {
            type: sequelize.STRING,
            allowNull: false
        },
        cityId: {
            type: sequelize.INTEGER,
            references: {
                model: 'cities',
                key: 'id'
            },
            allowNull: false
        }
    });
    await queryInterface.addIndex('parcel_ids', ['cityId', 'parcelId'], { indicesType: 'UNIQUE' });
}