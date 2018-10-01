import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('auth_audits', {
        id: {type: sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        ip: { type: sequelize.STRING, allowNull: false },
        method: { type: sequelize.STRING, allowNull: false },
        request: { type: sequelize.STRING, allowNull: false },
        response: { type: sequelize.STRING, allowNull: false },
        extras: {
            type: sequelize.JSON,
            allowNull: false,
            defaultValue: {}
        },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE },
    });
}