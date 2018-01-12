import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('developers', 'cover', {
        type: sequelize.STRING(256),
        allowNull: true,
        validate: {notEmpty: true}
    });
}