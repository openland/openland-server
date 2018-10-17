import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.sequelize.query('INSERT INTO parcel_ids("cityId", "parcelId") SELECT "cityId", "lotId" FROM lots ON CONFLICT DO NOTHING;');
}