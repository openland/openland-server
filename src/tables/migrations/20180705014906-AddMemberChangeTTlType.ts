import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.changeColumn(
        'organization_invites',
        'ttl',
        {
            type: sequelize.BIGINT,
            allowNull: true
        });
}