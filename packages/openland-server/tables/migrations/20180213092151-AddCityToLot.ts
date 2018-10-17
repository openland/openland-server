import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.sequelize.query('TRUNCATE TABLE "lots" CASCADE');
    await queryInterface.addColumn('lots', 'cityId', {
        type: sequelize.INTEGER,
        references: {
            model: 'cities',
            key: 'id'
        },
        allowNull: false
    });
}