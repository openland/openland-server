import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('user_presences', 'lastActive', {
        type: sequelize.DATE,
        allowNull: true
    });
    await queryInterface.addColumn('user_presences', 'lastActiveTimeout', {
        type: sequelize.DATE,
        allowNull: true
    });
}