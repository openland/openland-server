import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('super_cities', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        key: { type: sequelize.STRING, allowNull: false, unique: true },
        name: { type: sequelize.STRING, allowNull: false },
        enabled: { type: sequelize.STRING, allowNull: false, defaultValue: false },
        blockSource: { type: sequelize.STRING, allowNull: true },
        blockSourceLayer: { type: sequelize.STRING, allowNull: true },
        parcelSource: { type: sequelize.STRING, allowNull: true },
        parcelSourceLayer: { type: sequelize.STRING, allowNull: true },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE }
    });
}