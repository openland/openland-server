import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('permits', 'parcelId', {
        type: sequelize.INTEGER, references: {
            model: 'lots',
            key: 'id',
        }
    });
}