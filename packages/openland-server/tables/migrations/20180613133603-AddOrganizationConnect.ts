import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('organization_connects', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        initiatorOrgId: { type: sequelize.INTEGER, allowNull: false, references: { model: 'organizations' } },
        ortargetOrgIdgId: { type: sequelize.INTEGER, allowNull: false, references: { model: 'organizations' } },
        followStatus: { type: sequelize.STRING, allowNull: false, defaultValue: 'NOT_FOLLOWING' },
    });
}