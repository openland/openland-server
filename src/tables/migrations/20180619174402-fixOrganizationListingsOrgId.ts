import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.renameColumn('organization_listings', 'orgrId', 'orgId');       
}