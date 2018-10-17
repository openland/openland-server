import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn(
        'users',
        'isBot',
        {
            type: sequelize.BOOLEAN,
            allowNull: true,
            defaultValue: false
        }
    );
}