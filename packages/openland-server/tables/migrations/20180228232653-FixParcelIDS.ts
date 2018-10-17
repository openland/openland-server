import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    queryInterface.addColumn('parcel_ids', 'createdAt', sequelize.DATE);
    queryInterface.addColumn('parcel_ids', 'updatedAt', sequelize.DATE);
}