import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('wall_posts', 'isDeleted', {
        type: sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
    });
}