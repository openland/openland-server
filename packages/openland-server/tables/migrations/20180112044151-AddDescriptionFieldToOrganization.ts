import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('developers', 'description', {
        type: sequelize.STRING(4096),
        allowNull: true,
        validate: {notEmpty: true}
    });
}