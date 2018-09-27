import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('auth_sessions', {
        id: {type: sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        sessionSalt: { type: sequelize.STRING, allowNull: false, unique: true },
        code: { type: sequelize.STRING, allowNull: false },
        codeExpires: { type: sequelize.DATE, allowNull: false },
        extras: {
            type: sequelize.JSON,
            allowNull: false,
            defaultValue: {}
        },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE },
    });
}