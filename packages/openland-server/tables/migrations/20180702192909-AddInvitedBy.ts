import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn(
        'organization_members',
        'invitedBy',
        {
            type: sequelize.INTEGER,
            allowNull: true,
            references: { model: 'users' }
        }
    );
}