import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('locks', {
        id: {type: sequelize.INTEGER, primaryKey: true, autoIncrement: true},
        key: {type: sequelize.STRING, allowNull: false, unique: true},
        seed: {type: sequelize.STRING, allowNull: false},
        timeout: {type: sequelize.DATE, allowNull: false},
        createdAt: sequelize.DATE,
        updatedAt: sequelize.DATE
    });
}