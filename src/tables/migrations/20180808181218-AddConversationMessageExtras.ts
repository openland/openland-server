import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('conversation_messages', 'extras', {
        type: sequelize.JSON,
        allowNull: false,
        defaultValue: {}
    });
}