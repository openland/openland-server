import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn(
        'organization_members',
        'showInContacts',
        {
            type: sequelize.BOOLEAN,
            allowNull: false,
            defaultValue: true
        }
    );
}