import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('conversation_user_states', 'notificationsSettings', {
        type: sequelize.JSON,
        defaultValue: {},
        allowNull: false
    });
}