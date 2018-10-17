import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn(
    'organization_invites',
    'isOneTime',
    {
        type: sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false
    });
    await queryInterface.addColumn(
    'organization_invites',
    'userName',
    {
        type: sequelize.STRING,
        allowNull: true
    });
    await queryInterface.addColumn(
    'organization_invites',
    'ttl',
    {
        type: sequelize.INTEGER,
        allowNull: true
    });
}