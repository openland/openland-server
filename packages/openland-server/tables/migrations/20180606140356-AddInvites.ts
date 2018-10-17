import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('organization_invites', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        uuid: { type: sequelize.STRING(256), allowNull: false, unique: true },
        orgId: { type: sequelize.INTEGER, allowNull: false, references: { model: 'organizations' } },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE }
    });
}