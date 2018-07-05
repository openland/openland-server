import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn(
        'organization_invites',
        'emailText',
        {
            type: sequelize.STRING(4096),
            allowNull: true
        }
    );
}