import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn(
        'organization_invites',
        'memberFirstName',
        {
            type: sequelize.STRING,
            allowNull: true
        }
    );
    await queryInterface.addColumn(
        'organization_invites',
        'memberLastName',
        {
            type: sequelize.STRING,
            allowNull: true
        }
    );
    await queryInterface.removeColumn('organization_invites', 'userName');
}