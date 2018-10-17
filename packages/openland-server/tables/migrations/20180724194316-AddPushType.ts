import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.addColumn('user_push_registrations', 'pushType', { type: sequelize.STRING, allowNull: false, defaultValue: 'web-push' });
    await queryInterface.addIndex('user_push_registrations', ['tokenId', 'pushType'], { indicesType: 'UNIQUE' });
}