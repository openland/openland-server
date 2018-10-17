import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.sequelize.query('CREATE INDEX permits_parcel_id ON "permits" ("parcelId" ASC, "permitCreated" DESC)');
}