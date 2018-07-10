import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn(
        'organization_invites',
        'type',
        {
            type: sequelize.ENUM('for_organization', 'for_member'),
            allowNull: false,
            defaultValue: 'for_member'
        }
    );
}