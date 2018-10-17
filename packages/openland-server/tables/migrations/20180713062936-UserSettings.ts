import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('user_settings', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        settings: { type: sequelize.JSON, allowNull: false, defaultValue: {} },
        userId: { type: sequelize.INTEGER, references: { model: 'users' }, allowNull: false, unique: true },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE }
    });
}