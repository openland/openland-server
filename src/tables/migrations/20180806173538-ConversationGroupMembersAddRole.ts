import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn(
        'conversation_group_members',
        'role',
        {
            type: sequelize.STRING,
            allowNull: false,
            defaultValue: 'member'
        }
    );
}