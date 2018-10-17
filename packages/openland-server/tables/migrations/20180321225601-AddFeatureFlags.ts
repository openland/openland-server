import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('feature_flags', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        key: {
            type: sequelize.STRING, allowNull: false, unique: true, validate: {
                is: /^[a-z\-]+$/i
            }
        },
        title: {
            type: sequelize.STRING, allowNull: false
        },
        createdAt: sequelize.DATE,
        updatedAt: sequelize.DATE
    });
    await queryInterface.createTable('organization_features', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        organizationId: {
            type: sequelize.INTEGER, references: { model: 'organizations', key: 'id', },
            allowNull: false
        },
        featureFlagId: {
            type: sequelize.INTEGER, references: { model: 'feature_flags', key: 'id', },
            allowNull: false
        },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE }
    });
    await queryInterface.addIndex('organization_features', ['organizationId', 'featureFlagId'], {
        indicesType: 'UNIQUE'
    });
}