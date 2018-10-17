import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('conversation_group_members', 'status', {
        type: sequelize.STRING,
        allowNull: true,
        defaultValue: 'member'
    });
}