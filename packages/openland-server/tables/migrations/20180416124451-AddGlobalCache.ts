import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface, sequelize: DataTypes) {
    await queryInterface.createTable('services_caches', {
        id: { type: sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        service: { type: sequelize.STRING, allowNull: false },
        key: { type: sequelize.STRING(4096), allowNull: false },
        content: { type: sequelize.JSON, allowNull: false },
        createdAt: { type: sequelize.DATE },
        updatedAt: { type: sequelize.DATE }
    });
    await queryInterface.addIndex('services_caches', ['service', 'key'], { indicesType: 'UNIQUE' });
}