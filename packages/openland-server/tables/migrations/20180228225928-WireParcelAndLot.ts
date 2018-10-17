import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('lots', 'primaryParcelId', {
        type: sequelize.INTEGER, references: {
            model: 'parcel_ids',
            key: 'id',
        }
    });
}