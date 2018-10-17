import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('user_profiles', 'primaryOrganization', {
        type: sequelize.INTEGER,
        allowNull: true,
        references: {
            model: 'organizations'
        }
    });
}