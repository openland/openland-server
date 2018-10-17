import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addIndex('organization_members', ['userId', 'orgId'], { indicesType: 'UNIQUE' });
}