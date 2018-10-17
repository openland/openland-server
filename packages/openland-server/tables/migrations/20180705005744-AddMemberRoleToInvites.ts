import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn(
    'organization_invites',
    'memberRole',
    {
        type: sequelize.STRING,
        allowNull: true
    });
}