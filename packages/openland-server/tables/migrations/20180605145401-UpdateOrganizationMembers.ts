import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('organization_members', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        userId: { type: sequelize.INTEGER, allowNull: false, references: { model: 'users' } },
        orgId: { type: sequelize.INTEGER, allowNull: false, references: { model: 'organizations' } },
        isOwner: { type: sequelize.BOOLEAN, allowNull: false },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE }
    });
}