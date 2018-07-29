import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('hits', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        category: { type: sequelize.STRING, allowNull: false },
        tag: { type: sequelize.STRING, allowNull: false },
        hitsCount: { type: sequelize.INTEGER, allowNull: false },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE },
    });
}